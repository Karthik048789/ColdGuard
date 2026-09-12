import zipfile
import os

def export_api_excel(filename, rows):
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
    <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>'''

    workbook = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets>
        <sheet name="API Documentation" sheetId="1" r:id="rId1"/>
    </sheets>
</workbook>'''

    workbook_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>'''

    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <fonts count="2">
        <font><sz val="11"/><name val="Calibri"/></font>
        <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    </fonts>
    <fills count="3">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
    </fills>
    <borders count="1">
        <border><left/><right/><top/><bottom/></border>
    </borders>
    <cellStyleXfs count="1">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    </cellStyleXfs>
    <cellXfs count="2">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    </cellXfs>
</styleSheet>'''

    shared_strings = []
    string_map = {}

    def get_string_id(s):
        s = str(s)
        if s not in string_map:
            string_map[s] = len(shared_strings)
            shared_strings.append(s)
        return string_map[s]

    sheet_data_xml = []
    for r_idx, row in enumerate(rows, start=1):
        row_xml = [f'<row r="{r_idx}">']
        is_header = (r_idx == 1)
        style_attr = ' s="1"' if is_header else ''
        for c_idx, val in enumerate(row, start=1):
            col_letter = chr(64 + c_idx)
            cell_ref = f"{col_letter}{r_idx}"
            s_id = get_string_id(val)
            row_xml.append(f'<c r="{cell_ref}" t="s"{style_attr}><v>{s_id}</v></c>')
        row_xml.append('</row>')
        sheet_data_xml.append(''.join(row_xml))

    ss_xml_parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{}" uniqueCount="{}">'.format(len(shared_strings), len(shared_strings))]
    for s in shared_strings:
        escaped_s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&apos;')
        ss_xml_parts.append(f'<si><t>{escaped_s}</t></si>')
    ss_xml_parts.append('</sst>')
    shared_strings_xml = ''.join(ss_xml_parts)

    sheet_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheetData>
        {''.join(sheet_data_xml)}
    </sheetData>
</worksheet>'''

    with zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types)
        z.writestr('_rels/.rels', rels)
        z.writestr('xl/workbook.xml', workbook)
        z.writestr('xl/_rels/workbook.xml.rels', workbook_rels)
        z.writestr('xl/styles.xml', styles)
        z.writestr('xl/sharedStrings.xml', shared_strings_xml)
        z.writestr('xl/worksheets/sheet1.xml', sheet_xml)

    print(f"Updated Excel Documentation at: {filename}")

if __name__ == '__main__':
    all_endpoints = [
        ["Module", "HTTP Method", "Endpoint", "Authentication", "Description", "Request Payload", "Response Payload"],
        
        # System & Health
        ["System", "GET", "/api/health", "Public", "Check backend API health status", "None", "{\n  \"status\": \"online\",\n  \"service\": \"ColdGuard AI API Engine\",\n  \"timestamp\": \"ISO-8601\"\n}"],
        
        # Auth Module
        ["Auth", "POST", "/api/auth/register", "Public", "Register a new user account with role", "{\n  \"name\": \"String\",\n  \"email\": \"String\",\n  \"password\": \"String\",\n  \"role\": \"manager|driver|receiver\",\n  \"phone\": \"String\"\n}", "{\n  \"success\": true,\n  \"message\": \"User registered\",\n  \"data\": { \"user\": {...}, \"token\": \"...\" }\n}"],
        ["Auth", "POST", "/api/auth/login", "Public", "Authenticate user & return Sanctum Bearer Token + Role", "{\n  \"email\": \"String\",\n  \"password\": \"String\"\n}", "{\n  \"success\": true,\n  \"message\": \"Login successful\",\n  \"data\": { \"user\": {...}, \"token\": \"...\" }\n}"],
        ["Auth", "GET", "/api/auth/me", "Bearer Token (auth:sanctum)", "Get profile & role of currently authenticated user", "Headers:\nAuthorization: Bearer <token>", "{\n  \"success\": true,\n  \"data\": { \"user\": {...} }\n}"],
        ["Auth", "POST", "/api/auth/logout", "Bearer Token (auth:sanctum)", "Revoke current Bearer Token", "Headers:\nAuthorization: Bearer <token>", "{\n  \"success\": true,\n  \"message\": \"Successfully logged out\"\n}"],

        # Shipment Module
        ["Shipment", "GET", "/api/shipments", "Public / Optional Bearer", "List shipments with dashboard summary stats (Active, At Risk, Delivered, Value Protected)", "Query Params:\nstatus=IN_TRANSIT|WARNING|CRITICAL|DELIVERED\nsearch=Kochi", "{\n  \"success\": true,\n  \"data\": {\n    \"statistics\": {\n      \"total_shipments\": 3,\n      \"active_shipments\": 2,\n      \"at_risk_shipments\": 0,\n      \"delivered_shipments\": 1,\n      \"total_value_protected_inr\": 255000.0\n    },\n    \"shipments\": [...]\n  }\n}"],
        ["Shipment", "POST", "/api/shipments", "Public / Optional Bearer", "Create a new healthcare cold-chain shipment", "{\n  \"product_name\": \"Measles-Rubella Vaccine\",\n  \"quantity\": 500,\n  \"origin_name\": \"Kochi Medical Cold Hub\",\n  \"origin_lat\": 9.9312,\n  \"origin_lng\": 76.2673,\n  \"destination_name\": \"Thrissur District Hospital\",\n  \"destination_lat\": 10.5276,\n  \"destination_lng\": 76.2144,\n  \"min_temp\": 2.0,\n  \"max_temp\": 8.0,\n  \"shipment_value\": 50000\n}", "{\n  \"success\": true,\n  \"message\": \"Shipment created successfully\",\n  \"data\": { \"shipment\": {...} }\n}"],
        ["Shipment", "GET", "/api/shipments/{id}", "Public / Optional Bearer", "Get single shipment details by ID or tracking number", "Path Param:\nid=1 or CG-2026-VACC-001", "{\n  \"success\": true,\n  \"data\": { \"shipment\": {...} }\n}"],
        ["Shipment", "POST", "/api/shipments/{id}/start", "Public / Optional Bearer", "Dispatch shipment (changes status to IN_TRANSIT)", "Path Param:\nid=1", "{\n  \"success\": true,\n  \"message\": \"Shipment dispatched successfully\",\n  \"data\": { \"shipment\": {...} }\n}"],
        ["Shipment", "POST", "/api/shipments/{id}/deliver", "Public / Optional Bearer", "Mark shipment as delivered (changes status to DELIVERED)", "Path Param:\nid=1", "{\n  \"success\": true,\n  \"message\": \"Shipment delivered successfully\",\n  \"data\": { \"shipment\": {...} }\n}"],

        # Telemetry Module
        ["Telemetry", "POST", "/api/shipments/{id}/telemetry", "Public / Optional Bearer", "Record a single telemetry reading for a shipment", "{\n  \"temperature\": 7.4,\n  \"humidity\": 71,\n  \"battery\": 88,\n  \"latitude\": 10.0159,\n  \"longitude\": 76.3419,\n  \"recorded_at\": \"2026-09-12T12:30:00Z\"\n}", "{\n  \"success\": true,\n  \"message\": \"Telemetry recorded successfully\",\n  \"data\": { \"id\": 1, \"shipment_id\": 1, \"temperature\": 7.4, ... }\n}"],
        ["Telemetry", "GET", "/api/shipments/{id}/telemetry", "Public / Optional Bearer", "Get all telemetry history for shipment ordered by recorded_at ASC", "Path Param:\nid=1 or CG-2026-VACC-001", "{\n  \"success\": true,\n  \"data\": [ {\"temperature\": 6.1, \"humidity\": 72, \"battery\": 92, \"latitude\": 10.0159, \"longitude\": 76.3419, ...}, ... ]\n}"],
        ["Telemetry", "GET", "/api/shipments/{id}/telemetry/latest", "Public / Optional Bearer", "Get the single latest telemetry reading for shipment (current truck location & sensor state)", "Path Param:\nid=1 or CG-2026-VACC-001", "{\n  \"success\": true,\n  \"data\": { \"temperature\": 7.8, \"humidity\": 70, \"battery\": 87, \"latitude\": 10.0250, \"longitude\": 76.3500, \"recorded_at\": \"...\" }\n}"],
        ["Telemetry", "POST", "/api/shipments/{id}/telemetry/simulate", "Public / Optional Bearer", "Run controlled telemetry simulation (normal or failure scenario)", "{\n  \"scenario\": \"normal|failure\"\n}", "{\n  \"success\": true,\n  \"message\": \"Telemetry simulation completed (failure scenario)\",\n  \"data\": { \"scenario\": \"failure\", \"total_generated\": 6, \"latest_reading\": {...}, \"readings\": [...] }\n}"],

        # RiskAnalysis Module
        ["RiskAnalysis", "POST", "/api/shipments/{id}/analyze-risk", "Public / Optional Bearer", "Evaluate AI risk score %, severity, failure ETA minutes, & recommendations based on telemetry trends", "Path Param:\nid=1 or CG-2026-VACC-001", "{\n  \"success\": true,\n  \"message\": \"Risk analysis evaluated successfully\",\n  \"data\": {\n    \"risk_score\": 91.5,\n    \"severity\": \"HIGH\",\n    \"predicted_failure_minutes\": 15,\n    \"reason\": \"Continuous temperature rise (+0.46°C/min)...\",\n    \"recommendation\": \"Cold-chain failure predicted in ~15 mins...\"\n  }\n}"],
        ["RiskAnalysis", "GET", "/api/shipments/{id}/risk-events", "Public / Optional Bearer", "Get all risk evaluation events history for a shipment ordered by created_at DESC", "Path Param:\nid=1 or CG-2026-VACC-001", "{\n  \"success\": true,\n  \"data\": [ {\"id\": 1, \"risk_score\": 91.5, \"severity\": \"HIGH\", \"predicted_failure_minutes\": 15, ...} ]\n}"],
        ["RiskAnalysis", "GET", "/api/shipments/{id}/risk-events/latest", "Public / Optional Bearer", "Get single latest risk evaluation event for a shipment", "Path Param:\nid=1 or CG-2026-VACC-001", "{\n  \"success\": true,\n  \"data\": { \"risk_score\": 91.5, \"severity\": \"HIGH\", \"predicted_failure_minutes\": 15, \"reason\": \"...\", \"recommendation\": \"...\" }\n}"],

        # AI Integration Module
        ["AI Integration", "POST", "/api/shipments/{id}/ai-analysis", "Public / Optional Bearer", "Generate Gemini AI interpretation, natural language explanation, urgency, and operational recommendation", "Path Param:\nid=1 or CG-2026-VACC-001", "{\n  \"success\": true,\n  \"data\": {\n    \"shipment\": { \"id\": 1, \"product_name\": \"...\" },\n    \"deterministic_risk\": { \"risk_score\": 98.0, \"severity\": \"CRITICAL\", \"predicted_failure_minutes\": 0 },\n    \"ai_interpretation\": {\n      \"summary\": \"Critical cold-chain risk detected.\",\n      \"risk_explanation\": \"The temperature is rising rapidly...\",\n      \"urgency\": \"Immediate intervention required.\",\n      \"recommended_action\": \"Identify a suitable nearby cold-storage facility...\",\n      \"confidence_note\": \"Generated via Gemini AI decision-support model...\"\n    }\n  }\n}"]
    ]
    
    excel_path = os.path.join(os.path.dirname(__file__), "ColdGuard_API_Documentation.xlsx")
    export_api_excel(excel_path, all_endpoints)
