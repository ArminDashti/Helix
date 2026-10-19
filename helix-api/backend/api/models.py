from django.conf import settings
from django.db import models


class TablePermission(models.Model):
    """Grant a user access to a specific schema or table of the warehouse."""

    SCOPE_SCHEMA = "schema"
    SCOPE_TABLE = "table"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="table_permissions",
    )
    scope = models.CharField(max_length=10, choices=[(SCOPE_SCHEMA, "Schema"), (SCOPE_TABLE, "Table")])
    # Schema name for SCOPE_SCHEMA; "schema.table" for SCOPE_TABLE.
    name = models.CharField(max_length=255)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "scope", "name"], name="uniq_user_scope_name"),
        ]

    def __str__(self) -> str:
        return f"{self.user.username}: {self.scope}:{self.name}"