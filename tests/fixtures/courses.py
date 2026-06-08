import pytest
from tests.utils.supabase_admin import get_admin_client


@pytest.fixture(scope="session")
def test_path():
    """Creates a dedicated test learning path. Deleted at session end."""
    client = get_admin_client()
    result = client.table("paths").insert({
        "slug": "test-path-regression",
        "name": "Test Path",
        "emoji": "🧪",
        "tagline_en": "Regression testing path",
        "tagline_te": "రిగ్రెషన్ టెస్టింగ్ పాత్",
        "description_en": "Used exclusively by the regression test suite",
        "description_te": "రిగ్రెషన్ టెస్ట్ సూట్ ద్వారా ఉపయోగించబడుతుంది",
        "is_active": True,
        "order_index": 999,
    }).execute()
    path_id = result.data[0]["id"]
    yield path_id
    client.table("paths").delete().eq("id", path_id).execute()


@pytest.fixture(scope="session")
def test_course(test_path):
    """Published free course. Session-scoped — created once and reused."""
    client = get_admin_client()
    result = client.table("courses").insert({
        "path_id": test_path,
        "slug": "regression-test-free-course",
        "emoji": "📖",
        "bg_color": "#1a0f00",
        "title_en": "Regression Test Course",
        "title_te": "రిగ్రెషన్ టెస్ట్ కోర్సు",
        "description_en": "Automated regression test course",
        "description_te": "స్వయంచాలక రిగ్రెషన్ టెస్ట్ కోర్సు",
        "instructor_en": "Test Instructor",
        "instructor_te": "టెస్ట్ ఇన్స్ట్రక్టర్",
        "category": "Test",
        "level": "Beginner",
        "duration": "1 week",
        "is_free": True,
        "price": 0,
        "is_published": True,
        "order_index": 999,
    }).execute()
    course = result.data[0]
    yield course
    client.table("courses").delete().eq("id", course["id"]).execute()


@pytest.fixture(scope="session")
def test_lesson(test_course):
    """One lesson inside test_course."""
    client = get_admin_client()
    result = client.table("lessons").insert({
        "course_id": test_course["id"],
        "title_en": "Regression Lesson 1",
        "title_te": "రిగ్రెషన్ పాఠం 1",
        "youtube_video_id": "dQw4w9WgXcQ",
        "order_index": 0,
    }).execute()
    lesson = result.data[0]
    yield lesson
    client.table("lessons").delete().eq("id", lesson["id"]).execute()


@pytest.fixture(scope="session")
def test_draft_course(test_path):
    """Unpublished course — must NOT appear in GET /api/courses."""
    client = get_admin_client()
    result = client.table("courses").insert({
        "path_id": test_path,
        "slug": "regression-test-draft-course",
        "emoji": "🔒",
        "bg_color": "#1a0f00",
        "title_en": "Draft Course — Should Be Hidden",
        "title_te": "డ్రాఫ్ట్ కోర్సు",
        "description_en": "This course must not be publicly visible",
        "description_te": "ఈ కోర్సు పబ్లిక్‌గా కనిపించకూడదు",
        "instructor_en": "Test Instructor",
        "instructor_te": "టెస్ట్ ఇన్స్ట్రక్టర్",
        "category": "Test",
        "level": "Beginner",
        "duration": "1 week",
        "is_free": True,
        "price": 0,
        "is_published": False,
        "order_index": 998,
    }).execute()
    course = result.data[0]
    yield course
    client.table("courses").delete().eq("id", course["id"]).execute()


@pytest.fixture
def enrolled_student(test_student, test_course):
    """
    Function-scoped: activates test_student in test_course for one test,
    then removes enrollment and progress on teardown.
    """
    client = get_admin_client()
    result = client.table("enrollments").insert({
        "user_id": test_student["id"],
        "course_id": test_course["id"],
        "is_active": True,
    }).execute()
    enrollment_id = result.data[0]["id"]
    yield
    client.table("user_progress").delete() \
        .eq("user_id", test_student["id"]) \
        .eq("course_id", test_course["id"]) \
        .execute()
    client.table("enrollments").delete().eq("id", enrollment_id).execute()
