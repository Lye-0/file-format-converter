# file-format-converter
ほとんどローカル完結！

<br>
<br>

# 主な機能

このアプリには、次の3つの機能があります。

- 変換
- 画像編集
- PDF編集

<br>
<br>


# 1. 変換

画像・音声・PDFを別の形式へ変換できます。


## 対応形式

| 種類 | 入力形式 | 出力形式 |
|---|---|---|
| **画像** | PNG / JPG / JPEG / WebP / AVIF / GIF / BMP / TIFF / TIF / HEIC / HEIF / SVG | PNG / JPG / WebP / AVIF / GIF / BMP / TIFF / HEIC / HEIF / ICO / PDF |
| **音声** | MP3 / WAV / FLAC / OGG / AAC / M4A | MP3 / WAV / FLAC / OGG / AAC / M4A |
| **PDF** | PDF | PNG / JPG |

> 入力形式によって、選択できる出力形式は異なります。

## 画像変換の対応関係

| 入力 | 主な出力 |
|---|---|
| PNG | JPG / WebP / AVIF / GIF / BMP / TIFF / HEIC / HEIF / ICO / PDF |
| JPG / JPEG | PNG / WebP / AVIF / GIF / BMP / TIFF / HEIC / HEIF / ICO / PDF |
| WebP | PNG / JPG / AVIF / GIF / BMP / TIFF / HEIC / HEIF / ICO / PDF |
| AVIF | PNG / JPG / WebP / GIF / BMP / TIFF / HEIC / HEIF / ICO / PDF |
| GIF | PNG / JPG / WebP / AVIF / BMP / TIFF / HEIC / HEIF / ICO / PDF |
| BMP | PNG / JPG / WebP / AVIF / GIF / TIFF / HEIC / HEIF / ICO / PDF |
| TIFF / TIF | PNG / JPG / WebP / AVIF / GIF / BMP / HEIC / HEIF / ICO / PDF |
| HEIC / HEIF | PNG / JPG / WebP / AVIF / GIF / BMP / TIFF / ICO / PDF |
| SVG | PNG / JPG / WebP / AVIF / PDF |

## 音声変換の対応関係

| 入力 | 出力 |
|---|---|
| MP3 | WAV / FLAC / OGG / AAC / M4A |
| WAV | MP3 / FLAC / OGG / AAC / M4A |
| FLAC | MP3 / WAV / OGG / AAC / M4A |
| OGG | MP3 / WAV / FLAC / AAC / M4A |
| AAC | MP3 / WAV / FLAC / OGG / M4A |
| M4A | MP3 / WAV / FLAC / OGG / AAC |

## PDF変換

| 入力 | 出力 | 備考 |
|---|---|---|
| PDF | PNG | 現在は1ページ目のみ |
| PDF | JPG | 現在は1ページ目のみ |

複数ページPDFの並べ替え・回転・分割・結合などは、「PDF編集」を使用してください。

## 特殊な出力

| 出力形式 | 内容 |
|---|---|
| ICO | 画像からICOを生成。必要に応じて最大256pxに調整 |
| PDF | 画像からPDFを生成 |

<br>
<br>
<br>


# 2. 画像編集

画像をプレビューしながら編集できます。

## 編集できる項目

| 項目        | 内容                                         |
| --------- | ------------------------------------------ |
| **出力形式**  | PNG / JPG / WebP / AVIF / GIF / BMP / TIFF |
| **画像サイズ** | %指定 / px指定                                 |
| **回転**    | 0° / 90° / 180° / 270°                     |
| **反転**    | 左右反転 / 上下反転                                |
| **品質**    | JPG / WebP / AVIFで1〜100%                   |

画像編集では、

`JPG → JPG`
`PNG → PNG`
`WebP → WebP`

のように、**形式を変えずに編集だけ行うこともできます。**

## 画像サイズ

画像サイズは2種類の方法で指定できます。

| 方法       | 内容             |
| -------- | -------------- |
| **%指定**  | 元画像に対して10〜200% |
| **px指定** | 幅・高さをピクセル単位で指定 |

px指定では、縦横比の固定にも対応しています。


<br>
<br>
<br>

# 3. PDF編集

PDFのページ構成を編集するための簡易PDFエディタです。



| 機能          | 内容                     |
| ----------- | ---------------------- |
| **並べ替え**    | サムネイルをドラッグしてページ順を変更    |
| **回転**      | 選択ページを左・右へ90°回転        |
| **削除**      | 選択ページを削除               |
| **分割**      | 選択ページを含め、それ以降を別PDFに分割  |
| **結合**      | 別のPDFを現在のPDFへ追加        |
| **PDF間移動**  | ページを別のPDFブロックへドラッグして移動 |
| **個別保存**    | 各PDFを個別にダウンロード         |
| **ZIP一括保存** | 編集後PDFをZIPにまとめて保存      |
| **PDF一括保存** | ZIPにせず各PDFをまとめて保存      |
