import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_header_footer(self, page_count):
        self.saveState()
        # Top Header (Only on page > 1)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#1e3a8a"))
            self.drawString(54, 750, "KALKI-KIT | COMPLETE A-TO-Z PROJECT ENCYCLOPEDIA & SYSTEM MANUAL")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawRightString(558, 750, "Enterprise Multimodal AI Disinformation Defense")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)

        # Bottom Footer
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(54, 36, "Confidential & Educational • KALKI-KIT A-Z Comprehensive Project Guide")
        self.drawRightString(558, 36, f"Page {self._pageNumber} of {page_count}")
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)
        self.restoreState()

def create_expanded_project_pdf():
    pdf_path = os.path.join(os.path.dirname(__file__), "KALKI_KIT_Complete_Project_Documentation.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Color Palette
    PRIMARY = colors.HexColor("#0f172a")     # Deep Slate Navy
    NAVY = colors.HexColor("#1e3a8a")        # Executive Navy
    ACCENT = colors.HexColor("#2563eb")      # Cobalt Blue
    CYAN = colors.HexColor("#0891b2")        # Cyan
    DARK = colors.HexColor("#0f172a")        # Text Main
    MUTED = colors.HexColor("#475569")       # Text Muted
    BG_LIGHT = colors.HexColor("#f8fafc")    # Slate 50
    BG_CARD = colors.HexColor("#f1f5f9")     # Slate 100
    BORDER = colors.HexColor("#cbd5e1")      # Border
    SUCCESS = colors.HexColor("#16a34a")     # Emerald
    WARNING = colors.HexColor("#d97706")     # Amber
    DANGER = colors.HexColor("#dc2626")      # Red

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=NAVY,
        spaceAfter=4
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=NAVY,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=ACCENT,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=DARK,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=DARK,
        leftIndent=10,
        spaceAfter=3
    )

    callout_style = ParagraphStyle(
        'Callout_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=MUTED
    )

    story = []

    # =========================================================================
    # COVER BANNER
    # =========================================================================
    banner_data = [
        [
            Paragraph("<b>KALKI-KIT</b><br/><font size=10 color='#93c5fd'><b>AI FORENSICS & DISINFORMATION DEFENSE PLATFORM</b></font>", ParagraphStyle('BTitle', fontName='Helvetica-Bold', fontSize=20, textColor=colors.white)),
            Paragraph("<b>A-TO-Z COMPLETE ENCYCLOPEDIA</b><br/><font size=8 color='#cbd5e1'>Beginner-Friendly Project Manual • Full Guide</font>", ParagraphStyle('BSub', fontName='Helvetica', fontSize=9, textColor=colors.white, alignment=2))
        ]
    ]
    banner_table = Table(banner_data, colWidths=[300, 204])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('PADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # CHAPTER 1: THE BIG PICTURE & PLAIN-ENGLISH PROJECT OVERVIEW
    # =========================================================================
    story.append(Paragraph("Chapter 1: The Big Picture (What is KALKI-KIT in Simple Words?)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=6))
    
    story.append(Paragraph("<b>1.1 What problem does this project solve?</b>", h2_style))
    story.append(Paragraph("Imagine opening your phone and seeing a video of a famous leader declaring a war, or a forwarded audio message on WhatsApp claiming that banks are shutting down. You panic. But in reality, that video was made by AI (a <b>deepfake</b>), and the audio note was recorded by an AI voice generator. Most people cannot tell the difference between real news and fake news.", body_style))
    story.append(Paragraph("<b>KALKI-KIT</b> was built to be your personal <b>digital shield and truth detector</b>. It gives everyday users, students, researchers, and cyber analysts an all-in-one suite of intelligent tools to check claims, uncover deepfakes, inspect voice recordings, view rumor outbreaks on a world map, and generate verified certificates.", body_style))

    story.append(Paragraph("<b>1.2 Who is this project for?</b>", h2_style))
    story.append(Paragraph("• <b>Everyday Internet Users:</b> To quickly test if a viral forwarded message, tweet, or video is genuine before sharing it with family and friends.", bullet_style))
    story.append(Paragraph("• <b>Fact-Checkers & Journalists:</b> To run multi-modal AI cross-referencing against verified global databases in seconds.", bullet_style))
    story.append(Paragraph("• <b>Cybersecurity & OSINT Analysts:</b> To analyze image compression pixel deltas (ELA), voice frequency harmonics, and track regional rumor propagation.", bullet_style))
    story.append(Paragraph("• <b>Students & Educators:</b> To learn digital literacy, master Google Dorking, take forensic quizzes, and earn downloadable certificates.", bullet_style))
    story.append(Spacer(1, 8))

    # =========================================================================
    # CHAPTER 2: COMPLETE ARCHITECTURE (FRONTEND, BACKEND, CLOUD AI)
    # =========================================================================
    story.append(Paragraph("Chapter 2: How KALKI-KIT Works (Frontend, Backend & AI)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=6))
    story.append(Paragraph("A web application is divided into two main halves: <b>Frontend</b> (what you see and click on your screen) and <b>Backend/Cloud</b> (the brain and storage running behind the scenes). Here is how both work in KALKI-KIT:", body_style))

    arch_data = [
        ["Layer", "Technology Used", "What it Does in Simple English"],
        ["User Interface (Frontend)", "HTML5 + Vanilla CSS3", "Creates the layout, typography, dark/light themes, glowing glass cards, and buttons."],
        ["Component System", "Bootstrap 5.3.2", "Provides responsive layout grids, dropdown menus, modals, and mobile drawers."],
        ["3D Graphics Engine", "Three.js (r128 WebGL)", "Renders the interactive 3D Quantum Neural Core in the showcase hero banner."],
        ["Interactive Charts", "Chart.js (v4.4)", "Renders dynamic line and doughnut charts tracking threat trends and categories."],
        ["World Threat Map", "Leaflet.js (v1.9.4)", "Renders satellite & dark geospatial maps with clickable city outbreak markers."],
        ["Knowledge Graph", "Vis.js (Network)", "Simulates physics-based 3D connected network nodes between claims and sources."],
        ["Fast Search Tables", "DataTables + jQuery", "Enables real-time keyword search, sorting, and pagination of claim records."],
        ["Poster Image Generator", "html2canvas", "Converts rendered verification result cards into downloadable high-res PNG images."],
        ["User Authentication", "Firebase Auth (v8)", "Manages user sign-up, login, password encryption, and secure session state."],
        ["Cloud Database", "Google Cloud Firestore", "NoSQL document database storing verification logs and threat telemetry in cloud."],
        ["Client-Side Database", "HTML5 LocalStorage", "Browser storage keeping your API keys, theme choice, and academy course progress."],
        ["AI Brain (Inference)", "Google Gemini 2.0 / 1.5", "Multimodal neural model performing deep semantic fact-checking on text & media."]
    ]
    t_arch = Table(arch_data, colWidths=[110, 120, 274])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7.5),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'TOP')
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 8))

    # =========================================================================
    # CHAPTER 3: DATABASE ARCHITECTURE (SQL vs NoSQL vs LocalStorage)
    # =========================================================================
    story.append(Paragraph("Chapter 3: The Database Explained (Did we use a Database?)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=6))
    story.append(Paragraph("<b>YES</b>, KALKI-KIT uses a dedicated database architecture. Here is the exact breakdown of how data is stored:", body_style))
    
    story.append(Paragraph("<b>1. Google Cloud Firestore (Primary Backend Database):</b>", h2_style))
    story.append(Paragraph("• <b>What is it?</b> Firestore is a modern <b>NoSQL Document Database</b> provided by Google Cloud. Unlike older SQL databases (like MySQL or PostgreSQL) that require strict tables with fixed columns and rows, Firestore stores data as flexible, hierarchical <b>JSON documents</b> inside <b>Collections</b>.", bullet_style))
    story.append(Paragraph("• <b>Why did we choose NoSQL over SQL?</b> Disinformation reports and claims are multimodal and unpredictable. One claim might only have text, while another has an audio spectrogram, image metadata, and a YouTube URL. NoSQL allows saving diverse records without breaking database schemas.", bullet_style))
    story.append(Paragraph("• <b>What is stored in Firestore?</b> User account metadata, cloud authentication records, and threat submission logs.", bullet_style))

    story.append(Paragraph("<b>2. HTML5 LocalStorage (Client-Side Storage):</b>", h2_style))
    story.append(Paragraph("• <b>What is it?</b> A persistent key-value storage engine built into every modern web browser. It saves data directly on your computer so it stays intact even if you refresh or close the browser.", bullet_style))
    story.append(Paragraph("• <b>What is stored in LocalStorage?</b> Your personal Gemini API key (kept 100% private on your machine), your active AI model choice, light/dark theme preference, and OSINT Academy test scores.", bullet_style))

    story.append(Paragraph("<b>3. In-Memory Baseline Dataset (<code>js/data.js</code>):</b>", h2_style))
    story.append(Paragraph("• A structured JavaScript data dictionary (<code>window.KalkiData</code>) providing initial verified claims, global threat coordinates, source credibility ratings, and knowledge graph links.", bullet_style))
    story.append(Spacer(1, 8))

    # =========================================================================
    # CHAPTER 4: THE A-TO-Z GUIDE OF EVERY BUTTON, FIELD & CONTROL
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("Chapter 4: Complete A-to-Z Guide to Every Button & Control", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=6))
    story.append(Paragraph("Here is an exhaustive, button-by-button explanation of every single interactive element across all 10 modules:", body_style))

    # Navigation & Topbar
    story.append(Paragraph("4.1 Global Navigation & Topbar Controls", h2_style))
    topbar_data = [
        ["Control / Button Name", "Where is it located?", "Exact Function in Plain Words"],
        ["Platform Showcase (Nav)", "Sidebar Menu", "Opens the Igloo.inc-inspired 3D WebGL interactive introduction and ecosystem story."],
        ["Command Dashboard (Nav)", "Sidebar Menu", "Opens the executive overview with live KPI counters, launchpad cards, and telemetry."],
        ["Claim Verification (Nav)", "Sidebar Menu", "Opens the multimodal AI engine to analyze text claims, URLs, images, audio, or video."],
        ["Claims Repository (Nav)", "Sidebar Menu", "Opens the searchable database table containing all verified claims and forensic verdicts."],
        ["Source Reliability (Nav)", "Sidebar Menu", "Opens the domain credibility index showing trust scores, bias ratings, and accuracy."],
        ["Geospatial Radar (Nav)", "Sidebar Menu", "Opens the interactive full-screen world map tracking regional rumor outbreaks live."],
        ["AI Forensics (Nav)", "Sidebar Menu", "Opens the 5-tool forensic studio (Image ELA, audio clone spectrogram, clickbait detox)."],
        ["OSINT Academy (Nav)", "Sidebar Menu", "Opens the interactive digital literacy academy, quiz simulation, and certificate maker."],
        ["Knowledge Graph (Nav)", "Sidebar Menu", "Opens the physics-simulated node graph linking claims, sources, and reviewers."],
        ["Social Threat Monitor (Nav)", "Sidebar Menu", "Opens the live viral feed monitoring risky claims circulating on X, WhatsApp, Telegram."],
        ["Intelligence Analytics (Nav)", "Sidebar Menu", "Opens radar charts comparing AI accuracy, latency, and 24-hour audit logs."],
        ["Docs (PDF) Button", "Topbar (Top-Right)", "Direct 1-click download of this complete project manual PDF to your computer."],
        ["Theme Toggle (Sun/Moon)", "Topbar (Top-Right)", "Switches instantly between High-Tech Dark Cyber theme and Crisp Slate Light theme."],
        ["Threat Alerts (Bell Icon)", "Topbar (Top-Right)", "Opens a slide-out drawer displaying breaking high-priority disinformation alerts."],
        ["System Settings (Gear Icon)", "Topbar (Top-Right)", "Opens a modal dialog to enter your Gemini API key and adjust confidence thresholds."],
        ["Verify Claim (Blue Button)", "Topbar (Top-Right)", "Instant shortcut button that jumps straight into the Claim Verification tool."],
        ["Global Search Bar", "Topbar (Center)", "Live filter searching claims, domains, and keywords across the entire application."],
        ["Logout Button", "Sidebar (Bottom)", "Securely ends the user session, clears session tokens, and returns to login.html."]
    ]
    t_topbar = Table(topbar_data, colWidths=[120, 110, 274])
    t_topbar.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('PADDING', (0,0), (-1,-1), 2.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE')
    ]))
    story.append(t_topbar)
    story.append(Spacer(1, 8))

    # Module 1: Platform Showcase
    story.append(Paragraph("4.2 Module 1: Platform Showcase (<code>landing.js</code>)", h2_style))
    story.append(Paragraph("• <b>3D WebGL Quantum Core:</b> Built with Three.js. It renders an illuminated 3D crystal icosahedron surrounded by dual counter-rotating gyroscopic rings and 750 floating stardust particles. You can <b>click and drag</b> with your mouse or finger to spin the 3D globe 360 degrees, or click it to trigger an energy pulse ripple.", bullet_style))
    story.append(Paragraph("• <b>Enter Command Center Button:</b> Transitions directly into the Command Dashboard.", bullet_style))
    story.append(Paragraph("• <b>Verify a Claim Button:</b> Routes directly into the Claim Verification Engine.", bullet_style))
    story.append(Paragraph("• <b>Explore Ecosystem Bento Cards:</b> 5 interactive glass cards showcasing the core tools with direct deep-links.", bullet_style))
    story.append(Paragraph("• <b>Live Telemetry Preview Chart:</b> A real-time Chart.js line graph displaying detected disinformation vectors vs verified facts over time.", bullet_style))
    story.append(Spacer(1, 6))

    # Module 2: Command Dashboard
    story.append(Paragraph("4.3 Module 2: Command Dashboard (<code>dashboard.js</code>)", h2_style))
    story.append(Paragraph("• <b>Start Claim Analysis Button:</b> Opens the verification scanner immediately.", bullet_style))
    story.append(Paragraph("• <b>Geospatial Radar Button:</b> Jumps to the interactive global threat map.", bullet_style))
    story.append(Paragraph("• <b>System Architecture Button:</b> Opens an interactive 4-step modal explaining the AI forensic pipeline.", bullet_style))
    story.append(Paragraph("• <b>Download Project Manual (PDF) Button:</b> Downloads this complete documentation PDF.", bullet_style))
    story.append(Paragraph("• <b>4 Live KPI Counter Cards:</b>", bullet_style))
    story.append(Paragraph("   - <i>Claims Verified Today (142):</i> Total number of claims checked in the last 24 hours.", bullet_style))
    story.append(Paragraph("   - <i>Disinformation Identified (89):</i> Number of fake news claims caught and blocked.", bullet_style))
    story.append(Paragraph("   - <i>High-Trust Sources (48):</i> Number of verified authoritative news organizations indexed.", bullet_style))
    story.append(Paragraph("   - <i>Mean AI Confidence (94.2%):</i> Average algorithmic certainty across all analyses.", bullet_style))
    story.append(Paragraph("• <b>Verification & Threat Volume Trends Chart:</b> Visualizes daily fake vs true news volume over the week.", bullet_style))
    story.append(Paragraph("• <b>Threat Distribution by Category Chart:</b> Doughnut chart breaking down threats into Health, War, Financial, Deepfake, and Politics.", bullet_style))
    story.append(Spacer(1, 6))

    # Module 3: Claim Verification Engine
    story.append(Paragraph("4.4 Module 3: Claim Verification Engine (<code>verification.js</code>)", h2_style))
    story.append(Paragraph("• <b>Active Engine Dropdown:</b> Allows selecting which Gemini AI model to use (Gemini 2.0 Flash, Gemini 1.5 Flash, Gemini 2.5 Flash, or Gemini 1.5 Flash-8B).", bullet_style))
    story.append(Paragraph("• <b>Statement / Text Tab:</b> Input field to paste rumors, text claims, or viral quotes.", bullet_style))
    story.append(Paragraph("• <b>Web URL Tab:</b> Input field to enter article or tweet URLs for automated web scraping and verification.", bullet_style))
    story.append(Paragraph("• <b>Image / Audio / Video Dropzone:</b> Drag-and-drop zone supporting JPG, PNG, MP4, MP3, and WAV files up to 15MB.", bullet_style))
    story.append(Paragraph("• <b>Execute Forensic Analysis Button:</b> Sends the input to the Gemini AI API, checks databases, computes the Reliability Index (0-100), and outputs an AI Decision Tree breakdown.", bullet_style))
    story.append(Paragraph("• <b>Generate Fact-Check Intelligence Card Button:</b> Opens the Shareable Poster Studio modal to preview and download a high-definition verification card with a QR code.", bullet_style))
    story.append(Spacer(1, 6))

    # Module 4: Verified Claims Repository
    story.append(Paragraph("4.5 Module 4: Verified Claims Repository (<code>claims.js</code>)", h2_style))
    story.append(Paragraph("• <b>Claims DataTable:</b> Interactive table showing Record ID, Claim Statement, Threat Category, Origin Source, Timestamp, and Forensic Status (Fake News, Verified True, Partially True, Deepfake).", bullet_style))
    story.append(Paragraph("• <b>Search Input:</b> Type any keyword to instantly filter claims in real time.", bullet_style))
    story.append(Paragraph("• <b>Action Buttons:</b> Eye icon (view full details), Pen icon (edit notes), Trash icon (delete claim record).", bullet_style))
    story.append(Paragraph("• <b>Clear Records Button:</b> Purges all claims from local repository history with safety confirmation.", bullet_style))
    story.append(Paragraph("• <b>New Verification Button:</b> Routes directly to the claim scanner.", bullet_style))
    story.append(Spacer(1, 6))

    # Module 5: Source Reliability Index
    story.append(Paragraph("4.6 Module 5: Source Reliability Index (<code>sources.js</code>)", h2_style))
    story.append(Paragraph("• <b>3 Metric Cards:</b> Displays counts for Highly Trusted Sources (8,245), Pending Review (142), and Blacklisted Domains (3,140).", bullet_style))
    story.append(Paragraph("• <b>Bias Category Badge:</b> Indicates whether a domain leans Left, Center, or Right.", bullet_style))
    story.append(Paragraph("• <b>Historical Accuracy Meter:</b> Shows factual accuracy percentage (e.g. 98.4%).", bullet_style))
    story.append(Paragraph("• <b>Evaluate Button:</b> Triggers a live AI audit of the domain's reputation.", bullet_style))
    story.append(Paragraph("• <b>Index New Source Button:</b> Opens a modal form to add and score a new publication.", bullet_style))
    story.append(Spacer(1, 6))

    # Module 6: Geospatial Threat Radar
    story.append(Paragraph("4.7 Module 6: Geospatial Threat Radar (<code>heatmap.js</code>)", h2_style))
    story.append(Paragraph("• <b>Scan Region Input & Scan Button:</b> Type any country or city name (e.g. 'India', 'France') and click Scan to auto-pan the map and simulate localized threat scanning.", bullet_style))
    story.append(Paragraph("• <b>Sync Live Intel (API) Button:</b> Connects to real-time satellite intelligence feeds.", bullet_style))
    story.append(Paragraph("• <b>Trigger Outbreak Button:</b> Triggers an animated viral ripple on the map simulating a rapid rumor outbreak.", bullet_style))
    story.append(Paragraph("• <b>Category Filter Pills (All, Deepfake, Financial, War, Health):</b> Filters map markers by threat category.", bullet_style))
    story.append(Paragraph("• <b>Map Layer Switcher (Cyber Dark, Satellite HD, Street Light):</b> Toggles Leaflet map visual tiles.", bullet_style))
    story.append(Paragraph("• <b>Interactive Map Pins:</b> Click any pulsing marker to view the rumor title, city, outbreak severity, and AI confidence score.", bullet_style))
    story.append(Spacer(1, 6))

    # Module 7: AI Forensics Arsenal
    story.append(Paragraph("4.8 Module 7: AI Forensics Arsenal (<code>deepfake.js</code>)", h2_style))
    story.append(Paragraph("• <b>Image ELA & Synthetic Lens:</b> Computes pixel compression error deltas to uncover Photoshop image splicing and AI inpainting.", bullet_style))
    story.append(Paragraph("• <b>Voice Cloning & Spectrogram:</b> Live audio frequency analyzer that reveals robotic, unnatural sound wave patterns in cloned voice notes.", bullet_style))
    story.append(Paragraph("• <b>Sensationalism & Hyperbole Analyzer:</b> Strips emotional manipulation, calculates the Outrage Index, and provides a neutral objective rewrite.", bullet_style))
    story.append(Paragraph("• <b>Messaging Forward Risk Scanner:</b> Calculates viral chain-mail forwarding risk score for WhatsApp messages.", bullet_style))
    story.append(Paragraph("• <b>Logical Fallacy Detector:</b> Flags manipulative logical fallacies (Ad Hominem, Strawman, False Dilemma, Slippery Slope).", bullet_style))
    story.append(Spacer(1, 6))

    # Module 8: OSINT & Training Academy
    story.append(Paragraph("4.9 Module 8: OSINT & Training Academy (<code>education.js</code>)", h2_style))
    story.append(Paragraph("• <b>Core Curriculum Tab (6 Modules):</b> Interactive lessons teaching fact-checking methods (SIFT, CRAAP test, reverse image searching).", bullet_style))
    story.append(Paragraph("• <b>Forensic Verification Arena Tab:</b> Real-world simulation game where you test your instincts against viral claims with instant debriefs and XP score multipliers.", bullet_style))
    story.append(Paragraph("• <b>Fact-Checker's Toolkit & Google Dorking Tab:</b> Interactive query builder to generate specialized Google search operators (<code>site:</code>, <code>filetype:</code>, <code>inurl:</code>).", bullet_style))
    story.append(Paragraph("• <b>Badges & Verifiable Certificate Tab:</b> Generates a personalized Fact-Checking Certification with your custom name, graduation date, gold seal, and PNG download.", bullet_style))
    story.append(Spacer(1, 6))

    # Module 9 & 10
    story.append(Paragraph("4.10 Knowledge Graph & Social Threat Monitor (<code>graph.js</code> & <code>social.js</code>)", h2_style))
    story.append(Paragraph("• <b>Interactive Knowledge Graph:</b> Vis.js physics canvas mapping connections between Claims (Pink), Sources (Cyan), and Organizations (Blue). Click and drag nodes to explore relationships.", bullet_style))
    story.append(Paragraph("• <b>Social Threat Monitor:</b> Displays live feed cards monitoring viral posts across X, Facebook, Telegram, and WhatsApp with Viral Spread Velocity meters (0-100).", bullet_style))
    story.append(Spacer(1, 8))

    # =========================================================================
    # CHAPTER 5: STEP-BY-STEP USER WORKFLOWS (HOW-TO GUIDES)
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("Chapter 5: Step-by-Step User Workflows (How to Use the App)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=6))

    story.append(Paragraph("<b>Workflow 1: How to Verify a Suspicious Text Claim or Forwarded Message</b>", h2_style))
    story.append(Paragraph("1. Click <b>Claim Verification</b> in the left sidebar or the blue <b>Verify Claim</b> button in the topbar.", bullet_style))
    story.append(Paragraph("2. Select the <b>Statement / Text</b> tab and paste the suspicious rumor or quote.", bullet_style))
    story.append(Paragraph("3. Click the <b>Execute Forensic Analysis</b> button.", bullet_style))
    story.append(Paragraph("4. The AI will cross-reference databases and display the <b>Final Verdict</b> (e.g. Disinformation Identified, Verified True), the <b>Reliability Score (0-100)</b>, and an <b>AI Decision Tree</b> explaining why.", bullet_style))
    story.append(Paragraph("5. (Optional) Click <b>Generate Fact-Check Intelligence Card</b> to preview and download a shareable poster image with a QR code.", bullet_style))

    story.append(Paragraph("<b>Workflow 2: How to Test an Image for AI Deepfakes or Editing (ELA)</b>", h2_style))
    story.append(Paragraph("1. Click <b>AI Forensics Arsenal</b> in the sidebar.", bullet_style))
    story.append(Paragraph("2. Select the first tab: <b>Image ELA & Synthetic Lens</b>.", bullet_style))
    story.append(Paragraph("3. Click or drag an image into the upload dropzone (or click a sample preset like 'AI Portrait' or 'Spliced Photo').", bullet_style))
    story.append(Paragraph("4. View the split-canvas comparison: Original Image on the left, and the <b>Error Level Analysis (ELA) heatmap</b> on the right showing highlighted pixel compression anomalies.", bullet_style))

    story.append(Paragraph("<b>Workflow 3: How to Complete the OSINT Academy and Download a Certificate</b>", h2_style))
    story.append(Paragraph("1. Click <b>OSINT & Training Academy</b> in the sidebar.", bullet_style))
    story.append(Paragraph("2. Click <b>Custom Call-Sign</b> to set your name as you want it to appear on your official certificate.", bullet_style))
    story.append(Paragraph("3. Complete the 6 core curriculum modules and take the quizzes to earn 100% progress.", bullet_style))
    story.append(Paragraph("4. Navigate to the <b>Badges & Verifiable Certificate</b> tab.", bullet_style))
    story.append(Paragraph("5. Click <b>View Official Credential</b> to open the certificate modal and click <b>Download High-Res PNG</b>.", bullet_style))
    story.append(Spacer(1, 8))

    # =========================================================================
    # CHAPTER 6: EXPANDED A-TO-Z GLOSSARY
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("Chapter 6: Complete A-to-Z Glossary of Every Technical Term", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=6))
    story.append(Paragraph("Every technical word used in the project explained in simple, everyday language:", body_style))

    glossary_expanded = [
        ["Term", "Simple, Easy-to-Understand Definition"],
        ["API (Application Programming Interface)", "A messenger that allows our website to communicate with Google's Gemini AI server to send claims and receive answers."],
        ["Audio Spectrogram", "A visual graph of sound waves used in forensics to spot synthetic robotic voice clones."],
        ["Authentication (Auth)", "The security process of checking who you are when you log in with your email and password."],
        ["Bootstrap", "A popular CSS framework that gives websites responsive grids, mobile menus, and pop-up modal dialogs."],
        ["Chart.js", "A JavaScript library that draws interactive line, bar, and doughnut charts on web pages."],
        ["CRAAP Test", "A fact-checking evaluation method: Currency (timing), Relevance, Authority, Accuracy, Purpose."],
        ["Deepfake", "Synthetic media (video, photo, or audio) generated or altered by AI to deceive people."],
        ["Disinformation", "False information created and spread deliberately with the intention to deceive and cause harm."],
        ["Error Level Analysis (ELA)", "A digital forensics method that checks image compression rates to find spliced or edited pixels."],
        ["Firebase", "Google Cloud's developer platform that provides user authentication and cloud database hosting."],
        ["Firestore (NoSQL)", "Google's cloud database that stores data in flexible JSON documents instead of rigid table rows."],
        ["Gemini AI", "Google's state-of-the-art multimodal artificial intelligence model that analyzes text, images, and audio."],
        ["Glassmorphism", "A modern UI design trend that makes cards look like frosted, translucent acrylic glass."],
        ["Google Dorking", "Advanced search query techniques (like site:, filetype:) used to find hidden public files online."],
        ["HTML5 / CSS3 / JS", "The core trio of web development: HTML gives structure, CSS gives styling, JS gives interactivity."],
        ["html2canvas", "A JavaScript tool that captures a section of a web page and saves it as a downloadable PNG image."],
        ["Knowledge Graph", "A network diagram that draws connected dots (nodes) and lines (edges) showing relationships between entities."],
        ["Leaflet.js", "A lightweight mapping library that displays interactive satellite maps with custom pins and popups."],
        ["LocalStorage", "A mini-database inside your browser that remembers your API keys and settings even after closing the tab."],
        ["Misinformation", "False information shared by people who genuinely believe it is true, without bad intentions."],
        ["Multimodal AI", "An artificial intelligence system that can understand multiple types of media at once (text, images, audio, video)."],
        ["NoSQL Database", "A flexible database system that stores data in document objects rather than fixed tables with columns."],
        ["OSINT (Open Source Intelligence)", "The skill of finding, investigating, and analyzing publicly available online information."],
        ["Outrage Index", "A metric from 0 to 100 measuring how much emotional rage-bait or sensationalism is present in a headline."],
        ["Propagation Velocity", "The speed at which a viral rumor spreads across social media networks (e.g. 6.2x faster than truth)."],
        ["QR Code", "A 2D barcode on fact-check posters that smartphone cameras can scan to verify truth authenticity."],
        ["REST API", "A standard method for websites to request data from external servers over the internet via HTTP."],
        ["SIFT Methodology", "A 4-step fact-checking routine: Stop, Investigate source, Find trusted coverage, Trace original context."],
        ["Single Page Application (SPA)", "A web app that loads once and switches views instantly without refreshing the entire browser page."],
        ["Three.js / WebGL", "A 3D graphics library that allows browsers to render realistic 3D objects using your computer's graphics card."],
        ["Vis.js", "A visualization library used to render interactive physics-simulated node networks and knowledge graphs."]
    ]
    t_g_exp = Table(glossary_expanded, colWidths=[130, 374])
    t_g_exp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('FONTNAME', (0,1), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME', (1,1), (1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('PADDING', (0,0), (-1,-1), 2.5),
        ('VALIGN', (0,0), (-1,-1), 'TOP')
    ]))
    story.append(t_g_exp)
    story.append(Spacer(1, 8))

    # =========================================================================
    # CHAPTER 7: FREQUENTLY ASKED QUESTIONS & VIVA / EXAM PREPARATION
    # =========================================================================
    story.append(PageBreak())
    story.append(Paragraph("Chapter 7: FAQ & Exam / Presentation Q&A Guide", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=6))
    story.append(Paragraph("If you are presenting this project to a teacher, examiner, or client, here are the top questions they will ask and how to answer them with confidence:", body_style))

    story.append(Paragraph("<b>Q1: What makes KALKI-KIT unique compared to traditional fact-checking websites?</b>", h2_style))
    story.append(Paragraph("<b>Answer:</b> Traditional fact-checking sites only verify text and rely entirely on slow human review. KALKI-KIT is <b>multimodal and automated</b>: it handles text, images, voice notes, and videos simultaneously using Gemini 2.0 AI, provides instant Error Level Analysis (ELA) and voice spectrogram forensics, maps viral rumors geographically, and allows generating shareable proof certificates with QR codes.", body_style))

    story.append(Paragraph("<b>Q2: Which database is used and why not traditional SQL?</b>", h2_style))
    story.append(Paragraph("<b>Answer:</b> We use <b>Google Cloud Firestore (NoSQL Document Database)</b> alongside <b>HTML5 LocalStorage</b>. We chose NoSQL because disinformation submissions vary wildly in data structure (some have audio files, others have tweets or satellite coordinates). NoSQL document collections handle this flexibility effortlessly without rigid schema migrations.", body_style))

    story.append(Paragraph("<b>Q3: How does the AI detect fake voices in audio files?</b>", h2_style))
    story.append(Paragraph("<b>Answer:</b> When an audio file is uploaded to the Voice Cloning tool, KALKI-KIT generates an <b>audio frequency spectrogram</b>. Human speech has natural acoustic harmonics and breathing pauses, whereas synthetic AI voice models produce unnatural metallic frequencies and abrupt pitch transitions that the AI identifies.", body_style))

    story.append(Paragraph("<b>Q4: Is the user's API Key and data safe?</b>", h2_style))
    story.append(Paragraph("<b>Answer:</b> Yes. API keys entered in System Settings are stored strictly on the client side inside the user's browser <code>localStorage</code>. They are never sent to or logged on third-party servers.", body_style))

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Expanded A-Z PDF generated successfully at: {pdf_path}")
    return pdf_path

if __name__ == "__main__":
    create_expanded_project_pdf()
