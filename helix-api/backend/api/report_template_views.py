"""HTTP handlers for report template CRUD."""

from __future__ import annotations

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import report_templates as store
from .views import _error, _json_body, _require_admin


@csrf_exempt
@require_http_methods(["GET", "POST"])
def report_templates_collection(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        include_disabled = request.GET.get("include_disabled") in ("1", "true", "yes")
        if include_disabled:
            denied = _require_admin(request)
            if isinstance(denied, JsonResponse):
                return denied
        try:
            items = store.list_templates(include_disabled=include_disabled)
        except ValueError as exc:
            return _error(str(exc))
        return JsonResponse({"templates": items})
    denied = _require_admin(request)
    if isinstance(denied, JsonResponse):
        return denied
    try:
        body = _json_body(request)
    except ValueError as exc:
        return _error(str(exc))
    try:
        item = store.create_template(body)
    except ValueError as exc:
        return _error(str(exc))
    except FileExistsError:
        return _error("Template already exists", 409)
    return JsonResponse(item, status=201)


@csrf_exempt
@require_http_methods(["GET", "PUT", "DELETE"])
def report_template_detail(request: HttpRequest, template_id: str) -> HttpResponse:
    if request.method == "GET":
        try:
            item = store.get_template(template_id)
        except KeyError:
            return _error("Template not found", 404)
        if item.get("disabled"):
            denied = _require_admin(request)
            if isinstance(denied, JsonResponse):
                return _error("Template not found", 404)
        return JsonResponse(item)
    denied = _require_admin(request)
    if isinstance(denied, JsonResponse):
        return denied
    if request.method == "DELETE":
        try:
            store.delete_template(template_id)
        except KeyError:
            return _error("Template not found", 404)
        return HttpResponse(status=204)
    try:
        body = _json_body(request)
    except ValueError as exc:
        return _error(str(exc))
    try:
        item = store.update_template(template_id, body)
    except KeyError:
        return _error("Template not found", 404)
    except ValueError as exc:
        return _error(str(exc))
    return JsonResponse(item)
