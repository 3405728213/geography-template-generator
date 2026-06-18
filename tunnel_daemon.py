"""
公网隧道守护进程 — 独立于 Flask 运行，自动重连
启动: python tunnel_daemon.py
停止: Ctrl+C
"""
import subprocess
import sys
import os
import re
import time
import signal
import threading

PORT = 5000
URL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.tunnel_url')
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.tunnel_log')

# ANSI 颜色
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
CYAN = '\033[96m'
RESET = '\033[0m'
BOLD = '\033[1m'

if sys.platform == 'win32':
    # Windows 下启用 ANSI
    import ctypes
    kernel32 = ctypes.windll.kernel32
    kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)


def clear_screen():
    os.system('cls' if sys.platform == 'win32' else 'clear')


def get_local_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "???"


def kill_old_tunnels():
    """杀掉旧的 SSH 隧道进程"""
    try:
        if sys.platform == 'win32':
            # 查找并杀掉连接 localhost.run 的 SSH 进程
            result = subprocess.run(
                ['tasklist', '/FI', 'IMAGENAME eq ssh.exe', '/FO', 'CSV', '/NH'],
                capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW
            )
            for line in result.stdout.strip().split('\n'):
                if 'ssh.exe' in line.lower():
                    parts = line.replace('"', '').split(',')
                    if len(parts) >= 2:
                        try:
                            pid = int(parts[1])
                            os.kill(pid, signal.SIGTERM)
                        except Exception:
                            pass
        else:
            subprocess.run(['pkill', '-f', 'localhost.run'], capture_output=True)
    except Exception:
        pass


def start_tunnel() -> subprocess.Popen | None:
    """启动一个新的 SSH 隧道，返回进程对象"""
    cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no",
        "-o", "ServerAliveInterval=10",       # 每 10 秒发送 keepalive
        "-o", "ServerAliveCountMax=2",        # 2 次失败后断开
        "-o", "TCPKeepAlive=yes",
        "-o", "ExitOnForwardFailure=yes",
        "-o", "ConnectTimeout=10",
        "-o", "ConnectionAttempts=3",
        "-R", f"80:127.0.0.1:{PORT}",
        "nokey@localhost.run"
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0,
            start_new_session=True if sys.platform != 'win32' else False
        )
        return proc
    except FileNotFoundError:
        print(f"{RED}✗ SSH 客户端不可用，请确保已安装 OpenSSH{RESET}")
        return None
    except Exception as e:
        print(f"{RED}✗ 启动隧道失败: {e}{RESET}")
        return None


def extract_url(line: str) -> str | None:
    """从 SSH 输出中提取公网 URL"""
    match = re.search(r'https://([a-zA-Z0-9]+\.lhr\.life)', line)
    if match:
        return match.group(0)
    match = re.search(r'https://([a-zA-Z0-9\-]+\.serveo\.net)', line)
    if match:
        return match.group(0)
    match = re.search(r'https://([a-zA-Z0-9\-]+\.serveousercontent\.com)', line)
    if match:
        return match.group(0)
    return None


def write_status(url: str | None, status: str):
    """更新状态文件"""
    data = f"{url or ''}\n{status}\n{time.strftime('%Y-%m-%d %H:%M:%S')}"
    with open(URL_FILE, 'w') as f:
        f.write(data)


def keepalive_thread(url: str, stop_event):
    """后台保活线程：每分钟 ping 一次隧道，防止空闲超时断开"""
    import urllib.request
    while not stop_event.is_set():
        stop_event.wait(60)  # 每 60 秒
        if stop_event.is_set():
            break
        try:
            req = urllib.request.Request(f"{url}/api/health", method="GET")
            urllib.request.urlopen(req, timeout=10)
        except Exception:
            pass  # 静默失败，主循环会检测断线


def main():
    clear_screen()
    print(f"{BOLD}{'=' * 55}{RESET}")
    print(f"{BOLD}  地理答题模板 — 公网隧道守护进程{RESET}")
    print(f"{BOLD}{'=' * 55}{RESET}")
    print(f"  本机 IP: {get_local_ip()}")
    print(f"  转发端口: {PORT}")
    print(f"  按 Ctrl+C 停止")
    print(f"{BOLD}{'=' * 55}{RESET}")
    print()

    kill_old_tunnels()
    time.sleep(1)

    retry_delay = 3
    max_retry_delay = 60
    tunnel_count = 0
    keeper_stop = None
    keeper_thread = None

    while True:
        tunnel_count += 1
        print(f"{CYAN}[{time.strftime('%H:%M:%S')}] 正在建立隧道连接... (#{tunnel_count}){RESET}")

        proc = start_tunnel()
        if proc is None:
            print(f"{RED}无法启动 SSH，5 秒后重试...{RESET}")
            time.sleep(5)
            continue

        url_found = None

        try:
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue

                # 检查是否有 URL
                if not url_found:
                    extracted = extract_url(line)
                    if extracted:
                        url_found = extracted
                        write_status(url_found, 'connected')
                        # 启动保活线程
                        if keeper_thread and keeper_thread.is_alive():
                            keeper_stop.set()
                            keeper_thread.join(timeout=1)
                        keeper_stop = threading.Event()
                        keeper_thread = threading.Thread(
                            target=keepalive_thread,
                            args=(url_found, keeper_stop),
                            daemon=True
                        )
                        keeper_thread.start()
                        print(f"{GREEN}✅ 隧道已建立！{RESET}")
                        print(f"{BOLD}   📱 公网地址: {GREEN}{url_found}{RESET}")
                        print(f"{CYAN}   守护中... (Ctrl+C 停止){RESET}")
                        print()
                        retry_delay = 3  # 重置重试延迟

                # 检查连接信息
                if 'tunneled with tls' in line.lower() or 'connection id' in line.lower():
                    continue
                if 'error' in line.lower() or 'warning' in line.lower():
                    print(f"{YELLOW}   {line}{RESET}")

        except KeyboardInterrupt:
            print(f"\n{YELLOW}正在停止隧道...{RESET}")
            if keeper_stop:
                keeper_stop.set()
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            write_status(None, 'stopped')
            print(f"{GREEN}隧道已停止。{RESET}")
            sys.exit(0)
        except Exception as e:
            print(f"{RED}隧道异常: {e}{RESET}")

        # 隧道断开，停止保活线程
        if keeper_stop:
            keeper_stop.set()

        url_found_before = url_found
        write_status(None, 'reconnecting')

        if url_found_before:
            print(f"{RED}✗ 隧道断开！{retry_delay} 秒后自动重连...{RESET}")
        else:
            print(f"{RED}✗ 未能建立隧道，{retry_delay} 秒后重试...{RESET}")

        # 确保旧进程已终止
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

        time.sleep(retry_delay)
        retry_delay = min(retry_delay * 2, max_retry_delay)


if __name__ == '__main__':
    main()
