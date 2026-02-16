<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Etiquetas de estoque</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #111; }
        .label-page { width: {{ $widthMm }}mm; height: {{ $heightMm }}mm; padding: 3mm; border: 1px solid #eee; page-break-after: always; }
        .label-page:last-child { page-break-after: auto; }
        .label-name { font-weight: bold; font-size: 11px; margin-bottom: 2px; word-break: break-word; }
        .label-line { font-size: 9px; color: #333; margin-bottom: 1px; }
        .label-qr { float: right; width: 28mm; height: 28mm; text-align: right; }
        .label-qr img { width: 24mm; height: 24mm; }
        .label-body { overflow: hidden; }
        .a4-page { page-break-after: always; }
        .a4-page:last-child { page-break-after: auto; }
        .label-grid { display: table; width: 100%; border-collapse: collapse; }
        .label-grid-row { display: table-row; }
        .label-cell { display: table-cell; width: 50%; padding: 4mm; vertical-align: top; }
    </style>
</head>
<body>
@if($perPage <= 1)
    @foreach($labels as $item)
        <div class="label-page">
            <div class="label-qr">@if(!empty($item['qr_image_src']))<img src="{{ $item['qr_image_src'] }}" alt="">@endif</div>
            <div class="label-body">
                <div class="label-name">{{ $item['product']->name }}</div>
                <div class="label-line">Cod: {{ $item['product']->code ?? '—' }}</div>
                @if(!empty($item['product']->manufacturer_code))
                    <div class="label-line">Fab: {{ $item['product']->manufacturer_code }}</div>
                @endif
                @if(!empty($item['product']->storage_location))
                    <div class="label-line">Loc: {{ $item['product']->storage_location }}</div>
                @endif
            </div>
        </div>
    @endforeach
@else
    @foreach(array_chunk($labels, $perPage) as $chunk)
        <div class="a4-page">
            <table class="label-grid" style="width:100%; height:277mm;">
                @foreach(array_chunk($chunk, 2) as $row)
                    <tr>
                        @foreach($row as $item)
                            <td style="width:50%; padding:4mm; vertical-align:top; border:1px solid #eee;">
                                <div class="label-qr" style="float:right;">@if(!empty($item['qr_image_src']))<img src="{{ $item['qr_image_src'] }}" alt="" style="width:24mm;height:24mm;">@endif</div>
                                <div class="label-body">
                                    <div class="label-name">{{ $item['product']->name }}</div>
                                    <div class="label-line">Cod: {{ $item['product']->code ?? '—' }}</div>
                                    @if(!empty($item['product']->manufacturer_code))<div class="label-line">Fab: {{ $item['product']->manufacturer_code }}</div>@endif
                                    @if(!empty($item['product']->storage_location))<div class="label-line">Loc: {{ $item['product']->storage_location }}</div>@endif
                                </div>
                            </td>
                        @endforeach
                        @if(count($row) < 2)<td style="width:50%;"></td>@endif
                    </tr>
                @endforeach
            </table>
        </div>
    @endforeach
@endif
</body>
</html>
