# คู่มือการใช้งาน VLOOKUP ข้ามชีท (ภาษาไทย)

คู่มือนี้อธิบายวิธีใช้งาน VLOOKUP ข้ามชีท พร้อมการระบุ Target Cell และการ Export ไฟล์ .xlsx

---

## 1) อัปโหลดไฟล์ Excel
1. เปิดหน้าเว็บของระบบ
2. กด **Upload** และเลือกไฟล์ `.xlsx` ที่มีหลายชีท
3. ระบบจะแสดงตัวอย่างข้อมูล (Preview)

---

## 2) เลือกชีทหลัก (Source Sheet)
1. ไปที่แผง **Excel Preview**
2. เลือกชีทที่เป็นข้อมูลหลัก (เช่น `Sheet1`)

---

## 3) เพิ่ม VLOOKUP
1. ไปที่แผง **VLOOKUP Configuration**
2. กดปุ่ม **Add VLOOKUP**

---

## 4) ตั้งค่า VLOOKUP
### เลือกคอลัมน์ต้นทาง (Source Column)
- เลือกคอลัมน์ที่มีค่าที่ใช้ค้นหา เช่น `item_id`

### เลือกชีทและคอลัมน์ค้นหา (Lookup Sheet)
- เลือก **Lookup Sheet** เช่น `Sheet2`
- เลือก **Key Column** เช่น `item_id`
- เลือก **Value Column** เช่น `price`

### ตั้งค่า Target Column (ถ้าต้องการเพิ่มคอลัมน์ใหม่)
- ใส่ชื่อคอลัมน์ผลลัพธ์ เช่น `price_lookup`

### ตั้งค่า Target Cell (ถ้าต้องการระบุตำแหน่งเฉพาะ)
- ใส่รูปแบบ **A1** เช่น `G2` หรือ `D2`
- แถวต้อง **>= 2** (เพราะแถวที่ 1 เป็น Header)

### ตั้งค่า Default Value (ถ้าไม่พบค่า)
- ใส่ค่าที่ต้องการ เช่น `0` หรือ `N/A`

---

## 5) ดูผลลัพธ์ก่อน Export
1. ระบบจะอัปเดต **Preview** อัตโนมัติ
2. ตรวจสอบว่าค่าที่ได้ถูกต้อง

---

## 6) Export ไฟล์ .xlsx
1. ไปที่หน้า **Review & Export**
2. กดปุ่ม **Export .xlsx**
3. ระบบจะดาวน์โหลดไฟล์ Excel ใหม่ที่รวมผลลัพธ์ VLOOKUP แล้ว

---

## ตัวอย่างการตั้งค่า
### ตัวอย่าง 1: ค้นหาราคา (price) จากชีทอื่น
- Source Sheet: `Sheet1`
- Source Column: `item_id`
- Lookup Sheet: `Sheet2`
- Key Column: `item_id`
- Value Column: `price`
- Target Cell: `G2`

### ตัวอย่าง 2: เพิ่มคอลัมน์ใหม่
- Source Column: `item_id`
- Lookup Sheet: `Products`
- Key Column: `item_id`
- Value Column: `price`
- Target Column: `price_lookup`

---

## หมายเหตุสำคัญ
- ถ้ากำหนด Target Cell แล้ว **ค่าจะถูกเขียนลงคอลัมน์ที่ตรงกับตำแหน่งนั้น**
- ถ้าคอลัมน์มีค่ามาก่อนและไม่ได้เปิด **Allow Overwrite** ระบบจะแจ้งเตือน
- ถ้าใส่ Target Cell ผิดรูปแบบ (เช่น `1G`) ระบบจะแจ้งว่าไม่ถูกต้อง
