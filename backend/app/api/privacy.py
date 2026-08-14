from fastapi import APIRouter

router = APIRouter(prefix="/api/privacy", tags=["Privacy"])

PRIVACY_POLICY = {
    "title": "Data Privacy Policy",
    "version": "1.0",
    "effective_date": "2025-01-01",
    "sections": [
        {
            "heading": "Introduction",
            "content": (
                "This Privacy Policy describes how the Portable Facial Recognition-Based "
                "Attendance Monitoring System collects, uses, stores, and protects your "
                "personal data in compliance with the Data Privacy Act of 2012 (RA 10173)."
            ),
        },
        {
            "heading": "Data Collected",
            "content": (
                "We collect the following personal data: (a) Facial embeddings — "
                "mathematical representations derived from facial images, NOT raw images; "
                "(b) Basic profile information — name, email, student ID; (c) Attendance "
                "records — session check-in times and verification method."
            ),
        },
        {
            "heading": "What Is NOT Collected",
            "content": (
                "Raw facial images are never stored after embedding generation. We do not "
                "collect location data, browsing history, device information, or any data "
                "unrelated to attendance monitoring."
            ),
        },
        {
            "heading": "Purpose of Processing",
            "content": (
                "Data is processed solely for attendance verification during institutional "
                "events. Facial embeddings are used to match registered students against "
                "live camera feeds at event checkpoints."
            ),
        },
        {
            "heading": "Data Protection",
            "content": (
                "All data is transmitted over HTTPS and stored in an encrypted database. "
                "Access is restricted to authorized personnel only. Facial embeddings are "
                "stored separately from personal identifying information."
            ),
        },
        {
            "heading": "Data Retention",
            "content": (
                "Personal data is retained for one (1) year after graduation or until you "
                "request removal, whichever comes first. Attendance records may be retained "
                "longer for institutional compliance purposes."
            ),
        },
        {
            "heading": "Your Rights",
            "content": (
                "Under RA 10173, you have the right to: (a) be informed of data collection; "
                "(b) access your data; (c) object to processing; (d) erase your data; "
                "(e) rectify inaccurate data; (f) withdraw consent at any time; "
                "(g) file a complaint with the National Privacy Commission."
            ),
        },
        {
            "heading": "Compliance",
            "content": (
                "This system complies with Republic Act No. 10173, otherwise known as the "
                "Data Privacy Act of 2012, and its implementing rules and regulations."
            ),
        },
        {
            "heading": "Contact",
            "content": (
                "For questions or concerns regarding your data privacy, please contact the "
                "Institution's Data Protection Officer at the Registrar's Office."
            ),
        },
    ],
}

DATA_RETENTION_POLICY = {
    "title": "Data Retention Policy",
    "version": "1.0",
    "effective_date": "2025-01-01",
    "items": [
        {
            "data_type": "Facial embeddings",
            "retention_period": "1 year after graduation or until removal request",
            "auto_deletion": "Annual purge of graduates + 1 year",
            "notes": "Deleted immediately upon approved removal request",
        },
        {
            "data_type": "Attendance logs",
            "retention_period": "5 years",
            "auto_deletion": "After 5 years from log date",
            "notes": "Retained for institutional compliance",
        },
        {
            "data_type": "Consent records",
            "retention_period": "5 years after consent withdrawal",
            "auto_deletion": "After 5 years",
            "notes": "Proof of consent kept for audit purposes",
        },
        {
            "data_type": "Account information",
            "retention_period": "Until account deletion or 1 year after graduation",
            "auto_deletion": "Upon graduation + 1 year",
            "notes": "Students may request earlier deletion",
        },
        {
            "data_type": "Data removal requests",
            "retention_period": "3 years after completion",
            "auto_deletion": "After 3 years",
            "notes": "Logged for compliance auditing",
        },
    ],
}


@router.get("/policy")
async def get_privacy_policy():
    return PRIVACY_POLICY


@router.get("/data-retention")
async def get_data_retention_policy():
    return DATA_RETENTION_POLICY
