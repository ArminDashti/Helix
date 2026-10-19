from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User

from .models import TablePermission


class TablePermissionInline(admin.TabularInline):
    model = TablePermission
    extra = 0


class HelixUserAdmin(UserAdmin):
    inlines = [TablePermissionInline]


admin.site.unregister(User)
admin.site.register(User, HelixUserAdmin)


@admin.register(TablePermission)
class TablePermissionAdmin(admin.ModelAdmin):
    list_display = ("user", "scope", "name")
    list_filter = ("scope",)
    search_fields = ("name", "user__username")