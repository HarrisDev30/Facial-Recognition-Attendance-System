import csv
import io
from datetime import UTC, datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def generate_attendance_csv(
    institution_name: str,
    event_name: str,
    session_name: str,
    attendance_records: list[dict],
) -> str:
    """Generate RFC 4180 CSV export of attendance logs."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Metadata headers
    writer.writerow(["# Attendify Biometric Attendance Report"])
    writer.writerow(["# Institution:", institution_name])
    writer.writerow(["# Event:", event_name])
    writer.writerow(["# Session:", session_name])
    writer.writerow(["# Generated At (UTC):", datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow(["# Total Verified Records:", len(attendance_records)])
    writer.writerow([])

    # Table Column Headers
    writer.writerow([
        "Student / Staff ID",
        "Last Name",
        "First Name",
        "Department / Program",
        "Timestamp (UTC)",
        "Verification Method",
        "Confidence Score",
        "Status",
    ])

    for row in attendance_records:
        writer.writerow([
            row.get("identifier", ""),
            row.get("last_name", ""),
            row.get("first_name", ""),
            row.get("department_name", "N/A"),
            row.get("timestamp", ""),
            row.get("verification_method", "face"),
            f"{row.get('confidence', 0.0):.2f}" if row.get("confidence") else "N/A",
            row.get("status", "present"),
        ])

    return output.getvalue()


def generate_attendance_pdf(
    institution_name: str,
    event_name: str,
    session_name: str,
    venue: str | None,
    session_date: str,
    attendance_records: list[dict],
) -> bytes:
    """Generate accredited PDF institutional attendance roster with university branding."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#475569"),
    )
    meta_style = ParagraphStyle(
        "MetaText",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
    )
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.white,
        fontName="Helvetica-Bold",
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
    )

    elements = []

    # Header section
    elements.append(Paragraph(institution_name.upper(), subtitle_style))
    elements.append(Paragraph("Official Biometric Attendance Roster", title_style))
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=12))

    # Event & Session Summary Grid
    summary_data = [
        [
            Paragraph(f"<b>Event:</b> {event_name}", meta_style),
            Paragraph(f"<b>Session:</b> {session_name}", meta_style),
        ],
        [
            Paragraph(f"<b>Venue:</b> {venue or 'Main Campus'}", meta_style),
            Paragraph(f"<b>Date:</b> {session_date}", meta_style),
        ],
        [
            Paragraph(f"<b>Total Turnout:</b> {len(attendance_records)} Attendees", meta_style),
            Paragraph(f"<b>Generated:</b> {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}", meta_style),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[270, 270])
    summary_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ])
    )
    elements.append(summary_table)
    elements.append(Spacer(1, 14))

    # Attendance Records Table
    table_rows = [
        [
            Paragraph("#", table_header_style),
            Paragraph("ID Number", table_header_style),
            Paragraph("Student / Staff Name", table_header_style),
            Paragraph("Department / Org", table_header_style),
            Paragraph("Time (UTC)", table_header_style),
            Paragraph("Method", table_header_style),
        ]
    ]

    for idx, r in enumerate(attendance_records, start=1):
        name = f"{r.get('last_name', '')}, {r.get('first_name', '')}".strip()
        time_str = r.get("timestamp", "")
        if "T" in time_str:
            time_str = time_str.split("T")[1][:8]

        table_rows.append([
            Paragraph(str(idx), table_cell_style),
            Paragraph(r.get("identifier", "—"), table_cell_style),
            Paragraph(name or "—", table_cell_style),
            Paragraph(r.get("department_name", "N/A"), table_cell_style),
            Paragraph(time_str or "—", table_cell_style),
            Paragraph(r.get("verification_method", "Face ID").capitalize(), table_cell_style),
        ])

    if len(table_rows) == 1:
        table_rows.append([
            Paragraph("—", table_cell_style),
            Paragraph("No check-ins recorded", table_cell_style),
            Paragraph("—", table_cell_style),
            Paragraph("—", table_cell_style),
            Paragraph("—", table_cell_style),
            Paragraph("—", table_cell_style),
        ])

    col_widths = [25, 80, 165, 140, 65, 65]
    records_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    records_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ])
    )
    elements.append(records_table)
    elements.append(Spacer(1, 24))

    # Signatory Section for Institutional Certification
    sig_data = [
        [
            Paragraph("<b>Prepared By:</b>", meta_style),
            Paragraph("<b>Verified By (Event Marshal):</b>", meta_style),
            Paragraph("<b>Approved By (Dean / Registrar):</b>", meta_style),
        ],
        [
            Spacer(1, 30),
            Spacer(1, 30),
            Spacer(1, 30),
        ],
        [
            Paragraph("____________________________<br/>Signature over Printed Name", meta_style),
            Paragraph("____________________________<br/>Signature over Printed Name", meta_style),
            Paragraph("____________________________<br/>Official Campus Seal", meta_style),
        ],
    ]
    sig_table = Table(sig_data, colWidths=[180, 180, 180])
    sig_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ])
    )
    elements.append(sig_table)

    doc.build(elements)
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data
