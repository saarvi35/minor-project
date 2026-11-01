from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class JWTLifecycleTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="jwt-user", email="jwt@example.test", password="Secure-pass-123"
        )

    def test_public_refresh_rotates_and_logout_blacklists_token(self):
        refresh = RefreshToken.for_user(self.user)
        response = self.client.post("/api/token/refresh/", {"refresh": str(refresh)}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        rotated_refresh = response.data["refresh"]
        self.client.force_authenticate(self.user)
        logout = self.client.post("/api/logout/", {"refresh": rotated_refresh}, format="json")
        self.assertEqual(logout.status_code, 200)

        rejected = self.client.post("/api/token/refresh/", {"refresh": rotated_refresh}, format="json")
        self.assertEqual(rejected.status_code, 401)
