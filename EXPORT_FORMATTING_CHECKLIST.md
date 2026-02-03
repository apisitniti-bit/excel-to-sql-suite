# Excel Export Formatting Checklist

## Requirements
- All exported .xlsx files must follow strict visual formatting rules.
- Applies to **all sheets** in the workbook.

## Formatting Rules

### 1. Header Row (Row 1)
- Background color: `#D0D0D0`
- Applies to **all columns** in the header row.
- No alternate styling on header row.

### 2. Row 2
- **No background color** (default/transparent).

### 3. Alternating Rows
- Start alternating from **Row 3**.
- Apply background color: `#CCFFCC`
- Pattern: Row 3, Row 5, Row 7, … (every other row).

### 4. Cell Formatting (All Cells)
- Data type: Text
- Font: Arial
- Font size: 10

---

## Verification Steps

### A. Export a Sample File
1. Upload any Excel file with multiple sheets.
2. Configure VLOOKUP (optional) or proceed to Export.
3. Click **Export .xlsx**.
4. Open the exported file in Excel.

### B. Visual Checks
For **each sheet** in the workbook:

1. **Header Row**
   - Row 1 background is `#D0D0D0` (light gray).
   - All columns in row 1 have the same background.

2. **Row 2**
   - Row 2 has **no background** (white/transparent).

3. **Alternating Rows**
   - Row 3 background is `#CCFFCC` (light green).
   - Row 4 has **no background**.
   - Row 5 background is `#CCFFCC`.
   - Continue pattern to the last row.

4. **Cell Values**
   - All cells are formatted as text.
   - Font is Arial, size 10.

### C. Edge Cases
- **Small dataset** (≤ 10 rows): verify pattern holds.
- **Large dataset** (> 1000 rows): verify pattern holds.
- **Multiple sheets**: verify each sheet follows the rules.
- **Empty rows**: ensure no unexpected styling.

---

## Expected Result

| Row | Background | Notes |
|-----|------------|-------|
| 1   | #D0D0D0    | Header row (all columns) |
| 2   | none       | No background |
| 3   | #CCFFCC    | Alternating start |
| 4   | none       | No background |
| 5   | #CCFFCC    | Alternating |
| …   | …          | Continue pattern |

---

## Troubleshooting

### If colors are missing:
- Ensure `cellStyles: true` is set in XLSX write options.
- Verify `applyTextFormatting` is called for each worksheet.

### If pattern is off by one row:
- Remember XLSX rows are 0-indexed: `rowIndex === 0` = Excel Row 1.
- Alternating condition `rowIndex >= 2 && rowIndex % 2 === 0` starts at Excel Row 3.

### If font is not Arial 10:
- Confirm `font: { name: 'Arial', sz: 10 }` is applied to every cell.

---

## Automation (Optional)

You can generate a simple test file via the UI and use Excel’s “Inspect Cell Style” to validate colors quickly.
