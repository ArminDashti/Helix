from django.contrib.auth.models import User

u, _ = User.objects.get_or_create(
    username="armin",
    defaults={"first_name": "Armin", "last_name": "Dashti", "is_staff": True, "is_superuser": True},
)
u.set_password("dopadopa123")
u.save()
print("user ok:", u.username, "admin:", u.is_superuser)