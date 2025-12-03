# Inventory Management System

A web-based Inventory Management System to manage **Products, Suppliers, and Orders** with CRUD operations.

## Features

* **Products**: Add, edit, delete products with SKU, name, price, stock.
* **Suppliers**: Add, edit, delete suppliers with name and contact.
* **Orders**: Add, edit, delete orders linking products and suppliers, track quantity, price, and status.
* Responsive UI with modern design.
* Styled buttons with icons for Edit and Delete actions.

## Project Structure

```
inventory-management/
├─ index.html          # Products page
├─ supplier.html       # Suppliers page
├─ order.html          # Orders page
├─ styles.css          # Styling for forms, tables, buttons
├─ script.js           # JavaScript for CRUD and API integration
└─ README.md           # Documentation
```

## Setup Instructions

1. Clone the repository:

```bash
git clone https://github.com/yourusername/inventory-management.git
cd inventory-management
```

2. Open any page (index.html, supplier.html, or order.html) in a browser.

3. Update API endpoint in `script.js` if needed:

```js
const API_BASE = "https://inventory-backend-roan.vercel.app";
```

4. Use the system to manage products, suppliers, and orders.

## Notes

* Ensure your backend supports CORS.
* Buttons include gradient design and icons for better UX.
* Uses local caches in JS to reduce API requests.

## License

Open-source and free to use.
