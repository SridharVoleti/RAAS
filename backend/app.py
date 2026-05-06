import os
from datetime import timedelta

from flask import Flask
from flask_cors import CORS

from routes_admin import admin_bp
from routes_auth import auth_bp
from routes_blog import blog_bp
from routes_learner import learner_bp


def create_app() -> Flask:
    app = Flask(__name__)

    app.config["SECRET_KEY"] = os.environ.get("APP_SECRET", "dev-secret-change-me")
    app.config["JWT_EXP"] = timedelta(hours=12)
    app.config["DATA_DIR"] = os.path.join(os.path.dirname(__file__), "data")

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(learner_bp, url_prefix="/api/learner")
    app.register_blueprint(blog_bp, url_prefix="/api/blog")

    @app.get("/api/health")
    def health():
        return {"ok": True}

    return app


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=5000, debug=True)
