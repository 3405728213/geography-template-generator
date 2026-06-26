"""
知识库数据库 — SQLite
存储用户上传的例题和地理知识点
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'knowledge.db')


def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # 返回字典式结果
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """初始化数据库表"""
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL DEFAULT '知识点',
            category TEXT NOT NULL DEFAULT '通用',
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


# ---- CRUD ----

def list_entries(entry_type: str = None, search: str = "", limit: int = 50):
    """列出条目，支持按类型和搜索词过滤"""
    conn = get_db()
    query = "SELECT * FROM knowledge_entries WHERE 1=1"
    params = []

    if entry_type:
        query += " AND type = ?"
        params.append(entry_type)

    if search:
        query += " AND (title LIKE ? OR tags LIKE ? OR content LIKE ?)"
        like = f"%{search}%"
        params.extend([like, like, like])

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_entry(entry_id: int):
    """获取单条"""
    conn = get_db()
    row = conn.execute("SELECT * FROM knowledge_entries WHERE id = ?", (entry_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def add_entry(entry_type: str, category: str, title: str, content: str, tags: str):
    """添加条目"""
    conn = get_db()
    conn.execute(
        "INSERT INTO knowledge_entries (type, category, title, content, tags) VALUES (?, ?, ?, ?, ?)",
        (entry_type, category, title, content, tags)
    )
    conn.commit()
    conn.close()


def update_entry(entry_id: int, category: str, title: str, content: str, tags: str):
    """更新条目"""
    conn = get_db()
    conn.execute(
        "UPDATE knowledge_entries SET category=?, title=?, content=?, tags=? WHERE id=?",
        (category, title, content, tags, entry_id)
    )
    conn.commit()
    conn.close()


def delete_entry(entry_id: int):
    """删除条目"""
    conn = get_db()
    conn.execute("DELETE FROM knowledge_entries WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()


def search_knowledge(query: str, question_type: str = "", limit: int = 5):
    """
    知识检索：根据用户查询匹配相关知识条目
    优先匹配 tags，其次标题，再次内容
    """
    conn = get_db()
    # 拆分用户输入为关键词
    keywords = [kw.strip() for kw in query.replace('，', ',').replace('、', ',').replace(' ', ',').split(',') if len(kw.strip()) >= 2]

    if not keywords:
        # 无关键词时返回最新通用条目
        rows = conn.execute(
            "SELECT * FROM knowledge_entries ORDER BY created_at DESC LIMIT ?",
            (limit,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    # 构建匹配条件：标题或标签包含任一关键词
    conditions = []
    params = []
    for kw in keywords:
        conditions.append("(title LIKE ? OR tags LIKE ?)")
        params.extend([f"%{kw}%", f"%{kw}%"])

    where = " OR ".join(conditions)
    rows = conn.execute(
        f"SELECT * FROM knowledge_entries WHERE {where} ORDER BY created_at DESC LIMIT ?",
        params + [limit]
    ).fetchall()

    conn.close()
    return [dict(r) for r in rows]


# 初始化
init_db()
