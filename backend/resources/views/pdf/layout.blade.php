<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>@yield('title')</title>
    <style>
        /* ─── Reset & Base ──────────────────────── */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #1e293b;
            background: #fff;
        }

        /* ─── Layout ────────────────────────────── */
        .page { padding: 35px 40px; }
        .page-break { page-break-after: always; }

        /* ─── Header ────────────────────────────── */
        .header {
            display: table;
            width: 100%;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 15px;
            margin-bottom: 25px;
        }
        .header-logo {
            display: table-cell;
            width: 50%;
            vertical-align: middle;
        }
        .header-logo .company-logo-img {
            max-height: 50px;
            max-width: 180px;
            margin-bottom: 4px;
        }
        .header-logo .company-name {
            font-size: 22px;
            font-weight: 700;
            color: #1e40af;
            letter-spacing: -0.5px;
        }
        .header-logo .company-tagline {
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 2px;
        }
        .header-info {
            display: table-cell;
            width: 50%;
            text-align: right;
            vertical-align: middle;
        }
        .header-info p {
            font-size: 9px;
            color: #64748b;
            line-height: 1.6;
        }

        /* ─── Document Title Badge ──────────────── */
        .doc-badge {
            display: table;
            width: 100%;
            margin-bottom: 22px;
        }
        .doc-badge-left {
            display: table-cell;
            vertical-align: middle;
        }
        .doc-badge-left .doc-type {
            font-size: 9px;
            font-weight: 700;
            color: #fff;
            background: #2563eb;
            padding: 3px 14px;
            border-radius: 3px;
            text-transform: uppercase;
            letter-spacing: 2px;
            display: inline-block;
        }
        .doc-badge-left .doc-number {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 4px;
        }
        .doc-badge-right {
            display: table-cell;
            text-align: right;
            vertical-align: middle;
        }
        .doc-badge-right .doc-date {
            font-size: 10px;
            color: #64748b;
        }
        .doc-badge-right .doc-date strong {
            color: #334155;
        }

        /* ─── Info Grid ─────────────────────────── */
        .info-grid {
            display: table;
            width: 100%;
            margin-bottom: 22px;
        }
        .info-col {
            display: table-cell;
            width: 50%;
            vertical-align: top;
        }
        .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 14px 16px;
            margin-right: 10px;
        }
        .info-col:last-child .info-box { margin-right: 0; margin-left: 10px; }
        .info-box-title {
            font-size: 8px;
            font-weight: 700;
            color: #2563eb;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
        }
        .info-row {
            display: table;
            width: 100%;
            margin-bottom: 3px;
        }
        .info-label {
            display: table-cell;
            width: 35%;
            font-size: 9px;
            color: #64748b;
            font-weight: 600;
            padding: 1px 0;
        }
        .info-value {
            display: table-cell;
            font-size: 10px;
            color: #1e293b;
            padding: 1px 0;
        }

        /* ─── Table ─────────────────────────────── */
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
        }
        .data-table thead th {
            background: #1e40af;
            color: #fff;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 8px 10px;
            text-align: left;
            border: none;
        }
        .data-table thead th:first-child { border-radius: 4px 0 0 0; }
        .data-table thead th:last-child { border-radius: 0 4px 0 0; text-align: right; }
        .data-table tbody td {
            padding: 8px 10px;
            font-size: 10px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
        }
        .data-table tbody tr:nth-child(even) { background: #f8fafc; }
        .data-table tbody td:last-child { text-align: right; }
        .data-table tfoot td {
            padding: 10px;
            font-size: 10px;
            font-weight: 700;
            border-top: 2px solid #1e40af;
        }

        /* ─── Totals ────────────────────────────── */
        .totals-box {
            float: right;
            width: 260px;
            background: #f0f4ff;
            border: 1px solid #bfdbfe;
            border-radius: 6px;
            padding: 14px 16px;
            margin-bottom: 22px;
        }
        .totals-row {
            display: table;
            width: 100%;
            margin-bottom: 4px;
        }
        .totals-label {
            display: table-cell;
            font-size: 10px;
            color: #64748b;
        }
        .totals-value {
            display: table-cell;
            text-align: right;
            font-size: 10px;
            color: #1e293b;
            font-weight: 600;
        }
        .totals-row.total-final {
            border-top: 2px solid #2563eb;
            padding-top: 8px;
            margin-top: 8px;
        }
        .totals-row.total-final .totals-label {
            font-size: 13px;
            font-weight: 700;
            color: #1e40af;
        }
        .totals-row.total-final .totals-value {
            font-size: 13px;
            font-weight: 700;
            color: #1e40af;
        }

        /* ─── Notes ─────────────────────────────── */
        .notes-section {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 22px;
        }
        .notes-title {
            font-size: 8px;
            font-weight: 700;
            color: #92400e;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 6px;
        }
        .notes-text {
            font-size: 10px;
            color: #78350f;
            line-height: 1.6;
        }

        /* ─── Signature ─────────────────────────── */
        .signatures {
            display: table;
            width: 100%;
            margin-top: 50px;
        }
        .sig-col {
            display: table-cell;
            width: 45%;
            text-align: center;
        }
        .sig-col:first-child { padding-right: 10%; }
        .sig-line {
            border-top: 1px solid #94a3b8;
            padding-top: 6px;
            margin-top: 40px;
        }
        .sig-name {
            font-size: 10px;
            font-weight: 600;
            color: #334155;
        }
        .sig-role {
            font-size: 8px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* ─── Footer ────────────────────────────── */
        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 10px 40px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 8px;
            color: #94a3b8;
        }
        .footer strong { color: #64748b; }

        /* ─── Status Badges ─────────────────────── */
        .status-badge {
            font-size: 8px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 3px;
            text-transform: uppercase;
            letter-spacing: 1px;
            display: inline-block;
        }
        .status-open { background: #dbeafe; color: #1e40af; }
        .status-in_progress { background: #fef3c7; color: #92400e; }
        .status-completed { background: #d1fae5; color: #065f46; }
        .status-approved { background: #d1fae5; color: #065f46; }
        .status-sent { background: #dbeafe; color: #1e40af; }
        .status-rejected { background: #fee2e2; color: #991b1b; }
        .status-cancelled { background: #fecaca; color: #7f1d1d; }

        .clearfix::after { content: ""; display: table; clear: both; }

        @yield('extra-styles')
    </style>
</head>
<body>
    <div class="page">
        {{-- Header --}}
        <div class="header">
            <div class="header-logo">
                @if(!empty($company_logo_path) && file_exists($company_logo_path))
                    <img class="company-logo-img" src="{{ $company_logo_path }}" alt="Logo">
                @endif
                <div class="company-name">{{ $tenant->name ?? 'Empresa' }}</div>
                @if(!empty($company_tagline))
                    <div class="company-tagline">{{ $company_tagline }}</div>
                @endif
            </div>
            <div class="header-info">
                <p>
                    @if($tenant->document ?? false)CNPJ: {{ $tenant->document }}<br>@endif
                    @if($tenant->phone ?? false)Tel: {{ $tenant->phone }}<br>@endif
                    @if($tenant->email ?? false){{ $tenant->email }}<br>@endif
                    @if($tenant->address ?? false){{ $tenant->address }}@endif
                </p>
            </div>
        </div>

        @yield('content')
    </div>

    <div class="footer">
        <strong>{{ $tenant->name ?? 'Empresa' }}</strong> — Documento gerado em {{ now()->format('d/m/Y H:i') }}
        &nbsp;|&nbsp; Página 1
    </div>
</body>
</html>
