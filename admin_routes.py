"""
知识库后台管理 API 路由
"""
import os
from flask import Blueprint, render_template, request, jsonify, session
from database import (
    list_entries, get_entry, add_entry,
    update_entry, delete_entry
)

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')


def require_admin():
    """检查是否已登录后台"""
    return session.get('admin_authenticated') == True


# ---- 页面 ----

@admin_bp.route('/')
def admin_page():
    """后台管理页面"""
    if not require_admin():
        return render_template('admin_login.html')
    return render_template('admin.html')


# ---- 认证 ----

@admin_bp.route('/api/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    if data and data.get('password') == ADMIN_PASSWORD:
        session['admin_authenticated'] = True
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "密码错误"}), 401


@admin_bp.route('/api/logout', methods=['POST'])
def admin_logout():
    session.pop('admin_authenticated', None)
    return jsonify({"success": True})


# ---- 条目 CRUD ----

@admin_bp.route('/api/entries')
def api_list():
    if not require_admin():
        return jsonify({"success": False, "error": "未登录"}), 401

    entry_type = request.args.get('type', '')
    search = request.args.get('search', '')
    entries = list_entries(entry_type=entry_type or None, search=search)
    return jsonify({"success": True, "entries": entries})


@admin_bp.route('/api/entries/<int:entry_id>')
def api_get(entry_id):
    if not require_admin():
        return jsonify({"success": False, "error": "未登录"}), 401

    entry = get_entry(entry_id)
    if entry:
        return jsonify({"success": True, "entry": entry})
    return jsonify({"success": False, "error": "未找到"}), 404


@admin_bp.route('/api/entries', methods=['POST'])
def api_add():
    if not require_admin():
        return jsonify({"success": False, "error": "未登录"}), 401

    data = request.get_json()
    if not data or not data.get('title', '').strip():
        return jsonify({"success": False, "error": "标题不能为空"}), 400

    add_entry(
        entry_type=data.get('type', '知识点'),
        category=data.get('category', '通用'),
        title=data['title'].strip(),
        content=data.get('content', '').strip(),
        tags=data.get('tags', '').strip()
    )
    return jsonify({"success": True})


@admin_bp.route('/api/entries/<int:entry_id>', methods=['PUT'])
def api_update(entry_id):
    if not require_admin():
        return jsonify({"success": False, "error": "未登录"}), 401

    data = request.get_json()
    if not data or not data.get('title', '').strip():
        return jsonify({"success": False, "error": "标题不能为空"}), 400

    update_entry(
        entry_id=entry_id,
        category=data.get('category', '通用'),
        title=data['title'].strip(),
        content=data.get('content', '').strip(),
        tags=data.get('tags', '').strip()
    )
    return jsonify({"success": True})


@admin_bp.route('/api/entries/<int:entry_id>', methods=['DELETE'])
def api_delete(entry_id):
    if not require_admin():
        return jsonify({"success": False, "error": "未登录"}), 401

    delete_entry(entry_id)
    return jsonify({"success": True})
