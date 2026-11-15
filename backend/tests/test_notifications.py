from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.conftest import _TEST_USER, TEST_ORG_ID

_NOTIFICATION_DEFAULTS = dict(
    org_id=TEST_ORG_ID,
    user_id=_TEST_USER.user_id,
    category="candidate",
    title="New candidate added: Alice Smith",
    body="Alice Smith has been added to your pipeline.",
    entity_id="c-abc123",
    entity_type="candidate",
)


def _seed_notification(db, **kwargs) -> dict:
    from candid.commons.models import Notification

    payload = {**_NOTIFICATION_DEFAULTS, **kwargs}
    notification = Notification(**payload)
    with Session(db._engine) as session:
        session.add(notification)
        session.commit()
        session.refresh(notification)
        return notification.model_dump()


class TestListNotifications:
    def test_listNotifications_shouldReturnEmpty_whenNoNotificationsExist(
        self, client: TestClient
    ) -> None:
        resp = client.get("/notifications")
        assert resp.status_code == 200
        data = resp.json()
        assert data["notifications"] == []
        assert data["unread_count"] == 0

    def test_listNotifications_shouldReturnAllNotifications_whenUnreadOnlyIsFalse(
        self, client: TestClient, db
    ) -> None:
        _seed_notification(db, title="Notification 1", is_read=True)
        _seed_notification(db, title="Notification 2", is_read=False)
        resp = client.get("/notifications?unread_only=false")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["notifications"]) == 2

    def test_listNotifications_shouldReturnOnlyUnread_whenUnreadOnlyIsTrue(
        self, client: TestClient, db
    ) -> None:
        _seed_notification(db, title="Read notif", is_read=True)
        _seed_notification(db, title="Unread notif", is_read=False)
        resp = client.get("/notifications?unread_only=true")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["notifications"]) == 1
        assert data["notifications"][0]["title"] == "Unread notif"

    def test_listNotifications_shouldIncludeUnreadCount_inResponse(
        self, client: TestClient, db
    ) -> None:
        _seed_notification(db, title="N1", is_read=True)
        _seed_notification(db, title="N2", is_read=False)
        _seed_notification(db, title="N3", is_read=False)
        resp = client.get("/notifications")
        assert resp.status_code == 200
        data = resp.json()
        assert data["unread_count"] == 2

    def test_listNotifications_shouldNotReturnOtherUsersNotifications(
        self, client: TestClient, db
    ) -> None:
        _seed_notification(db, user_id="other-user", title="Other user's notif")
        resp = client.get("/notifications")
        assert resp.status_code == 200
        assert resp.json()["notifications"] == []


class TestMarkRead:
    def test_markRead_shouldMarkNotificationAsRead_whenNotificationExists(
        self, client: TestClient, db
    ) -> None:
        notification = _seed_notification(db, is_read=False)
        resp = client.patch(f"/notifications/{notification['id']}/read")
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True

    def test_markRead_shouldReturn404_whenNotificationNotFound(
        self, client: TestClient
    ) -> None:
        resp = client.patch("/notifications/ntf-doesnotexist/read")
        assert resp.status_code == 404

    def test_markRead_shouldReturn404_whenNotificationBelongsToOtherUser(
        self, client: TestClient, db
    ) -> None:
        notification = _seed_notification(db, user_id="other-user")
        resp = client.patch(f"/notifications/{notification['id']}/read")
        assert resp.status_code == 404


class TestMarkAllRead:
    def test_markAllRead_shouldMarkAllNotificationsAsRead(
        self, client: TestClient, db
    ) -> None:
        _seed_notification(db, title="N1", is_read=False)
        _seed_notification(db, title="N2", is_read=False)
        _seed_notification(db, title="N3", is_read=True)
        resp = client.post("/notifications/read-all")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["updated_count"] == 2

        list_resp = client.get("/notifications")
        assert list_resp.json()["unread_count"] == 0

    def test_markAllRead_shouldReturnZeroCount_whenAllAlreadyRead(
        self, client: TestClient, db
    ) -> None:
        _seed_notification(db, is_read=True)
        resp = client.post("/notifications/read-all")
        assert resp.status_code == 200
        assert resp.json()["updated_count"] == 0


class TestCandidateCreatesNotification:
    def test_createCandidate_shouldCreateNotification(
        self, client: TestClient
    ) -> None:
        resp = client.post(
            "/candidates",
            json={"first_name": "John", "last_name": "Doe"},
        )
        assert resp.status_code == 201

        notif_resp = client.get("/notifications")
        notifications = notif_resp.json()["notifications"]
        assert len(notifications) == 1
        assert notifications[0]["category"] == "candidate"
        assert "John Doe" in notifications[0]["title"]
        assert notifications[0]["entity_type"] == "candidate"
        assert notifications[0]["is_read"] is False
