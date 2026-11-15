from sqlmodel import Session

from candid.commons.models import Notification


class NotificationService:
    """Creates and persists Notification records for various domain events."""

    def create_notification(
        self,
        session: Session,
        org_id: str,
        user_id: str,
        category: str,
        title: str,
        body: str,
        entity_id: str,
        entity_type: str,
    ) -> Notification:
        notification = Notification(
            org_id=org_id,
            user_id=user_id,
            category=category,
            title=title,
            body=body,
            entity_id=entity_id,
            entity_type=entity_type,
        )
        session.add(notification)
        session.commit()
        session.refresh(notification)
        return notification

    def create_candidate_added_notification(
        self,
        session: Session,
        org_id: str,
        user_id: str,
        candidate_first_name: str,
        candidate_last_name: str,
        candidate_id: str,
    ) -> Notification:
        full_name = f"{candidate_first_name} {candidate_last_name}"
        return self.create_notification(
            session=session,
            org_id=org_id,
            user_id=user_id,
            category="candidate",
            title=f"New candidate added: {full_name}",
            body=f"{full_name} has been added to your pipeline.",
            entity_id=candidate_id,
            entity_type="candidate",
        )

    def create_analysis_complete_notification(
        self,
        session: Session,
        org_id: str,
        user_id: str,
        candidate_first_name: str,
        candidate_id: str,
    ) -> Notification:
        return self.create_notification(
            session=session,
            org_id=org_id,
            user_id=user_id,
            category="analysis",
            title=f"Pre-interview analysis ready for {candidate_first_name}",
            body="AI analysis is complete. Review strengths, gaps, and suggested questions.",
            entity_id=candidate_id,
            entity_type="candidate",
        )

    def create_invitation_accepted_notification(
        self,
        session: Session,
        org_id: str,
        user_id: str,
        invitee_email: str,
        org_name: str,
    ) -> Notification:
        return self.create_notification(
            session=session,
            org_id=org_id,
            user_id=user_id,
            category="invitation",
            title=f"{invitee_email} joined {org_name}",
            body=f"{invitee_email} has accepted the invitation and joined your organization.",
            entity_id=org_id,
            entity_type="invitation",
        )
