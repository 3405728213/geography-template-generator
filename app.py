"""
高中地理大题答题模板自动生成器 — Flask 主应用
支持 Anthropic Claude 和 DeepSeek 两种 AI 提供商
"""
import json
import os
import re
import sys
import subprocess
from flask import Flask, render_template, request, jsonify

# 尝试加载 .env 文件
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from prompts import (
    build_full_system_prompt,
    QUESTION_TYPE_PROMPTS,
    KNOWLEDGE_MODULES,
    DIFFICULTY_LEVELS
)

app = Flask(__name__)

# ----------------------------------------------------------------
# 配置
# ----------------------------------------------------------------
PROVIDER = os.getenv("AI_PROVIDER", "deepseek")  # "anthropic" 或 "deepseek"

# Anthropic 配置
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

# DeepSeek 配置
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

# 根据 provider 确定实际使用的 Key 和模型
if PROVIDER == "deepseek":
    API_KEY = DEEPSEEK_API_KEY
    DEFAULT_MODEL = DEEPSEEK_MODEL
else:
    API_KEY = ANTHROPIC_API_KEY
    DEFAULT_MODEL = ANTHROPIC_MODEL


# ----------------------------------------------------------------
# JSON 清洗
# ----------------------------------------------------------------
def clean_json_response(text: str) -> str:
    """清洗 AI 返回的文本，提取 JSON"""
    text = text.strip()
    # 移除可能的 markdown 代码块标记
    text = re.sub(r'^```(?:json)?\s*\n?', '', text)
    text = re.sub(r'\n?```\s*$', '', text)
    return text


# ----------------------------------------------------------------
# Claude API
# ----------------------------------------------------------------
def _check_anthropic_sdk():
    """检查 Anthropic SDK 是否可用"""
    try:
        from anthropic import Anthropic  # noqa: F401
        return True
    except ImportError:
        return False


def call_anthropic(system_prompt: str, user_message: str) -> dict:
    """调用 Anthropic Claude API"""
    if not _check_anthropic_sdk():
        raise RuntimeError(
            "Anthropic SDK 未安装。请运行: pip install anthropic"
        )
    if not ANTHROPIC_API_KEY:
        raise RuntimeError(
            "未设置 ANTHROPIC_API_KEY。请在 .env 中配置"
        )

    from anthropic import Anthropic
    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=4096,
        temperature=0.7,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )

    content = response.content[0].text
    return _parse_response(content)


# ----------------------------------------------------------------
# DeepSeek API（OpenAI 兼容格式）
# ----------------------------------------------------------------
def _check_openai_sdk():
    """检查 OpenAI SDK 是否可用"""
    try:
        from openai import OpenAI  # noqa: F401
        return True
    except ImportError:
        return False


def call_deepseek(system_prompt: str, user_message: str) -> dict:
    """调用 DeepSeek API（OpenAI 兼容协议）"""
    if not DEEPSEEK_API_KEY:
        raise RuntimeError(
            "未设置 DEEPSEEK_API_KEY。请在 .env 中配置"
        )

    # 优先使用 OpenAI SDK，否则用原生 HTTP 请求
    if _check_openai_sdk():
        return _call_deepseek_via_sdk(system_prompt, user_message)
    else:
        return _call_deepseek_via_http(system_prompt, user_message)


def _call_deepseek_via_sdk(system_prompt: str, user_message: str) -> dict:
    """通过 OpenAI SDK 调用 DeepSeek"""
    from openai import OpenAI

    client = OpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url="https://api.deepseek.com"
    )

    response = client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        max_tokens=4096,
        temperature=0.7,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
    )

    content = response.choices[0].message.content
    return _parse_response(content)


def _call_deepseek_via_http(system_prompt: str, user_message: str) -> dict:
    """通过原生 HTTP 请求调用 DeepSeek（无需额外 SDK）"""
    import urllib.request
    import urllib.error

    url = "https://api.deepseek.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
    }
    body = json.dumps({
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "max_tokens": 4096,
        "temperature": 0.7
    }).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"]
        return _parse_response(content)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DeepSeek API 错误 ({e.code}): {err_body}")
    except Exception as e:
        raise RuntimeError(f"网络请求失败: {str(e)}")


# ----------------------------------------------------------------
# 通用响应解析
# ----------------------------------------------------------------
def _parse_response(content: str) -> dict:
    """解析 AI 返回的内容为结构化模板"""
    cleaned = clean_json_response(content)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        return {
            "thinking_approach": "（JSON 解析失败，以下是原始输出）",
            "framework": cleaned,
            "keywords": "",
            "example": "",
            "scoring_tips": "",
            "raw_error": str(e)
        }


# ----------------------------------------------------------------
# 统一调用入口
# ----------------------------------------------------------------
def call_ai(system_prompt: str, user_message: str) -> dict:
    """根据配置选择 AI 提供商"""
    if PROVIDER == "deepseek":
        return call_deepseek(system_prompt, user_message)
    else:
        return call_anthropic(system_prompt, user_message)


# ----------------------------------------------------------------
# 路由
# ----------------------------------------------------------------
@app.route("/")
def index():
    """主页面"""
    return render_template("index.html")


@app.route("/api/config")
def get_config():
    """返回前端需要的配置信息"""
    return jsonify({
        "question_types": {
            key: {
                "label": val["label"],
                "icon": val["icon"],
                "description": val["description"],
                "subtypes": val["subtypes"]
            }
            for key, val in QUESTION_TYPE_PROMPTS.items()
        },
        "knowledge_modules": KNOWLEDGE_MODULES,
        "difficulty_levels": list(DIFFICULTY_LEVELS.keys()),
        "api_available": bool(API_KEY),
        "provider": PROVIDER,
        "model": DEFAULT_MODEL
    })


@app.route("/api/generate", methods=["POST"])
def generate_template():
    """生成答题模板"""
    data = request.get_json()

    if not data:
        return jsonify({"success": False, "error": "请求体为空"}), 400

    question_type = data.get("question_type", "")
    question_subtype = data.get("question_subtype", "")
    topic = data.get("topic", "").strip()
    knowledge_module = data.get("knowledge_module", "综合")
    difficulty = data.get("difficulty", "基础模板")

    # 参数校验
    if not topic:
        return jsonify({"success": False, "error": "请输入题目或知识点"}), 400
    if question_type not in QUESTION_TYPE_PROMPTS:
        return jsonify({"success": False, "error": f"未知题型: {question_type}"}), 400
    if not API_KEY:
        provider_name = "DeepSeek" if PROVIDER == "deepseek" else "Anthropic"
        key_var = "DEEPSEEK_API_KEY" if PROVIDER == "deepseek" else "ANTHROPIC_API_KEY"
        return jsonify({
            "success": False,
            "error": f"未配置 {provider_name} API Key。请在 .env 文件中设置 {key_var}"
        }), 500

    # 构建 Prompt
    system_prompt = build_full_system_prompt(
        question_type=question_type,
        question_subtype=question_subtype,
        knowledge_module=knowledge_module,
        difficulty=difficulty
    )

    user_message = f"请为以下题目生成答题模板：\n\n{topic}"

    # 调用 AI
    try:
        template_data = call_ai(system_prompt, user_message)
        return jsonify({
            "success": True,
            "template": template_data,
            "provider": PROVIDER,
            "model": DEFAULT_MODEL
        })
    except RuntimeError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"AI 调用失败: {str(e)}"
        }), 500


@app.route("/api/tunnel-url")
def get_tunnel_url():
    """返回当前公网隧道 URL（由守护进程写入）"""
    url = get_public_url()
    return jsonify({
        "public_url": url,
        "local_url": f"http://{get_local_ip()}:5000"
    })


@app.route("/api/health")
def health():
    """健康检查"""
    return jsonify({
        "status": "ok",
        "api_available": bool(API_KEY),
        "provider": PROVIDER,
        "model": DEFAULT_MODEL,
        "public_url": get_public_url()
    })


def get_local_ip() -> str:
    """获取本机局域网 IP 地址"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "无法获取"


# 公网隧道 URL 文件（由 tunnel_daemon.py 写入）
TUNNEL_URL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.tunnel_url')


def get_public_url() -> str | None:
    """读取隧道守护进程写入的公网 URL"""
    if not os.path.exists(TUNNEL_URL_FILE):
        return None
    try:
        with open(TUNNEL_URL_FILE, 'r') as f:
            content = f.read().strip()
        url = content.split('\n')[0].strip()
        if url and url.startswith('https://'):
            return url
    except Exception:
        pass
    return None


# ----------------------------------------------------------------
# 启动
# ----------------------------------------------------------------
if __name__ == "__main__":
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

    local_ip = get_local_ip()
    public_url = get_public_url()

    print("=" * 60)
    print("  高中地理大题答题模板自动生成器")
    print("  Geography Answer Template Generator")
    print("=" * 60)
    print(f"  AI 提供商: {PROVIDER}")
    print(f"  使用模型: {DEFAULT_MODEL}")
    print(f"  API 状态: {'[已配置]' if API_KEY else '[未配置 Key]'}")
    print(f"")
    print(f"  💻 电脑访问: http://localhost:5000")
    print(f"  📱 局域网访问: http://{local_ip}:5000 (同 WiFi)")
    if public_url:
        print(f"  🌐 公网访问: {public_url}")
        print(f"     (任意设备、任意网络均可访问)")
    else:
        print(f"  ⚠️  公网隧道未启动")
        print(f"     请在新终端运行: python tunnel_daemon.py")
    print("=" * 60)

    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    app.run(debug=debug, host="0.0.0.0", port=port)
