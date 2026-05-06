from io import BytesIO
from typing import Any, Dict

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def generate_certificate_pdf(student_email: str, course_title: str, certificate_id: str, completed_at: str) -> bytes:
    buf = BytesIO()

    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width / 2, height - 120, "Certificate of Completion")

    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 180, "This certifies that")

    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width / 2, height - 220, student_email)

    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 270, "has successfully completed")

    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width / 2, height - 310, course_title)

    c.setFont("Helvetica", 12)
    c.drawString(60, 80, f"Certificate ID: {certificate_id}")
    c.drawRightString(width - 60, 80, f"Completed: {completed_at}")

    c.showPage()
    c.save()

    return buf.getvalue()
