import os

import pytest

from app import create_app


@pytest.fixture()
def client(tmp_path):
    app = create_app()
    app.config["TESTING"] = True
    app.config["DATA_DIR"] = str(tmp_path)

    with app.test_client() as c:
        yield c


def test_register_and_login(client):
    r = client.post("/api/auth/register", json={"email": "a@b.com", "password": "pw"})
    assert r.status_code == 200
    body = r.get_json()
    assert body["token"]
    assert body["user"]["email"] == "a@b.com"

    r2 = client.post("/api/auth/login", json={"email": "a@b.com", "password": "pw"})
    assert r2.status_code == 200
    body2 = r2.get_json()
    assert body2["token"]
