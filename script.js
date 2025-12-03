// ---------- API Integration ----------
// Set your backend base URL here
const API_BASE = "https://inventory-backend-roan.vercel.app";

async function fetchJSON(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const opts = Object.assign({ headers: {} }, options);
  if (opts.body && typeof opts.body === "object") {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  // Some endpoints may return empty body (204)
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return null;
}

function getId(obj) {
  return obj.id || obj._id || obj.sku || obj.productId || obj.product_id;
}

function _labelFromProductRef(ref) {
  if (!ref) return '';
  if (typeof ref === 'object') {
    return ref.name || ref.title || ref.sku || ref._id || JSON.stringify(ref);
  }
  return String(ref);
}

function _formatOrderItem(it) {
  // item may contain product, productId (string or object), sku, name
  const prodRef = it.product || it.productId || it.product_id || it.sku || it.name;
  const label = _labelFromProductRef(prodRef) || _labelFromProductRef(it);
  const qty = it.qty ?? it.quantity ?? 1;
  return `${label} x${qty}`;
}

function _formatSupplierField(o) {
  // supplier info might be in different shapes
  const s = o.supplier || o.supplierId || o.supplierName || o.supplierObj || o.supplier_info;
  if (!s) return '';
  if (typeof s === 'object') return s.name || s.title || s.contact || s._id || JSON.stringify(s);
  return String(s);
}

// ---------- Products ----------
let editingProductId = null;
// local cache of products to avoid relying on GET /products/:id if backend doesn't provide it
const productsCache = {};
// local cache for suppliers (similar to products)
const suppliersCache = {};
// local cache for orders
const ordersCache = {};
async function loadProducts() {
  const tableBody = document.querySelector("#product-table tbody");
  if (!tableBody) return;
  try {
    const products = await fetchJSON("/products");
    tableBody.innerHTML = "";
    (products || []).forEach((p) => {
      // populate cache by id for quick lookup when editing
      const pid = getId(p);
      if (pid) productsCache[pid] = p;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.sku || ""}</td>
        <td>${p.name || ""}</td>
        <td>${p.price ?? ""}</td>
        <td>${p.stock ?? ""}</td>
        <td>
          <button class="edit-product">Edit</button>
          <button class="delete-product">Delete</button>
        </td>
      `;
      const editBtn = tr.querySelector(".edit-product");
      const deleteBtn = tr.querySelector(".delete-product");
      editBtn.addEventListener("click", () => editProduct(getId(p)));
      deleteBtn.addEventListener("click", () => deleteProduct(getId(p)));
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load products:", err);
    tableBody.innerHTML = `<tr><td colspan=5>Error loading products</td></tr>`;
  }
}

async function addProduct(e) {
  e.preventDefault();
  const sku = document.getElementById("sku").value.trim();
  const name = document.getElementById("name").value.trim();
  const price = Number(document.getElementById("price").value);
  const stock = Number(document.getElementById("stock").value);
  
  // Validation
  if (!sku) {
    alert("SKU is required and cannot be empty");
    return;
  }
  if (!name) {
    alert("Product Name is required");
    return;
  }
  if (isNaN(price) || price < 0) {
    alert("Price must be a valid number >= 0");
    return;
  }
  if (isNaN(stock) || stock < 0) {
    alert("Stock must be a valid number >= 0");
    return;
  }
  
  try {
    if (editingProductId) {
      await fetchJSON(`/products/${editingProductId}`, { method: "PUT", body: { sku, name, price, stock } });
      editingProductId = null;
      const form = document.getElementById("product-form");
      if (form) form.querySelector('button[type="submit"]').textContent = 'Add Product';
      alert("Product updated successfully!");
    } else {
      await fetchJSON("/products", { method: "POST", body: { sku, name, price, stock } });
      alert("Product added successfully!");
    }
    e.target.reset();
    await loadProducts();
  } catch (err) {
    console.error("Add product failed:", err);
    alert("Failed to add product: " + err.message);
  }
}

async function editProduct(id) {
  // Try to get product from local cache first (some backends don't implement GET /products/:id)
  const cached = productsCache[id];
  if (cached) {
    document.getElementById('sku').value = cached.sku || '';
    document.getElementById('name').value = cached.name || '';
    document.getElementById('price').value = cached.price ?? '';
    document.getElementById('stock').value = cached.stock ?? '';
    editingProductId = id;
    const form = document.getElementById("product-form");
    if (form) form.querySelector('button[type="submit"]').textContent = 'Save Product';
    form.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // Fallback: try to fetch single product by id (may 404 if backend doesn't support it)
  try {
    const p = await fetchJSON(`/products/${id}`);
    if (!p) return alert('Product data not available');
    document.getElementById('sku').value = p.sku || '';
    document.getElementById('name').value = p.name || '';
    document.getElementById('price').value = p.price ?? '';
    document.getElementById('stock').value = p.stock ?? '';
    editingProductId = id;
    const form = document.getElementById("product-form");
    if (form) form.querySelector('button[type="submit"]').textContent = 'Save Product';
    form.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Edit product failed:', err);
    if (err.message && err.message.includes('HTTP 404')) {
      alert('Product not retrievable by id from server. Try refreshing the Products list and edit again.');
    } else {
      alert('Failed to load product for edit: ' + err.message);
    }
  }
}

async function deleteProduct(id) {
  if (!id) return alert("Cannot determine product id to delete");
  if (!confirm("Delete this product?")) return;
  try {
    await fetchJSON(`/products/${id}`, { method: "DELETE" });
    await loadProducts();
  } catch (err) {
    console.error("Delete product failed:", err);
    alert("Failed to delete product: " + err.message);
  }
}

// ---------- Suppliers ----------
let editingSupplierId = null;
async function loadSuppliers() {
  const tableBody = document.querySelector("#supplier-table tbody");
  const select = document.getElementById("order-supplierId"); 
  try {
    const suppliers = await fetchJSON("/supplies");
    if (tableBody) tableBody.innerHTML = "";
    if (select) {
      // keep the default option
      const defaultOpt = select.querySelector('option[value=""]');
      select.innerHTML = "";
      if (defaultOpt) select.appendChild(defaultOpt);
    }
    (suppliers || []).forEach((s) => {
      // populate suppliers cache
      const sid = getId(s) || s.name;
      if (sid) suppliersCache[sid] = s;
      if (tableBody) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${s.name || ""}</td>
          <td>${s.contact || ""}</td>
          <td>
            <button class="edit-supplier">Edit</button>
            <button class="delete-supplier">Delete</button>
          </td>
        `;
        const editBtn = tr.querySelector('.edit-supplier');
        const deleteBtn = tr.querySelector('.delete-supplier');
        editBtn.addEventListener('click', () => editSupplier(getId(s)));
        deleteBtn.addEventListener('click', () => deleteSupplier(getId(s)));
        tableBody.appendChild(tr);
      }
      if (select) {
        const opt = document.createElement("option");
        opt.value = getId(s) || s.name;
        opt.textContent = s.name || opt.value;
        select.appendChild(opt);
      }
    });
  } catch (err) {
    console.error("Failed to load suppliers:", err);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan=3>Error loading suppliers</td></tr>`;
  }
}

async function addSupplier(e) {
  e.preventDefault();
  const name = document.getElementById("supplier-name").value.trim();
  const contact = document.getElementById("supplier-contact").value.trim();
  
  // Validation
  if (!name) {
    alert("Supplier Name is required");
    return;
  }
  if (!contact) {
    alert("Contact is required");
    return;
  }
  
  try {
    if (editingSupplierId) {
      await fetchJSON(`/supplies/${editingSupplierId}`, { method: 'PUT', body: { name, contact } });
      editingSupplierId = null;
      const form = document.getElementById('supplier-form');
      if (form) form.querySelector('button[type="submit"]').textContent = 'Add Supplier';
      alert("Supplier updated successfully!");
    } else {
      await fetchJSON("/supplies", { method: "POST", body: { name, contact } });
      alert("Supplier added successfully!");
    }
    e.target.reset();
    await loadSuppliers();
  } catch (err) {
    console.error("Add supplier failed:", err);
    alert("Failed to add supplier: " + err.message);
  }
}

async function editSupplier(id) {
  // Try cache first (backend may not support GET /supplies/:id)
  const cached = suppliersCache[id];
  if (cached) {
    document.getElementById('supplier-name').value = cached.name || '';
    document.getElementById('supplier-contact').value = cached.contact || '';
    editingSupplierId = id;
    const form = document.getElementById('supplier-form');
    if (form) form.querySelector('button[type="submit"]').textContent = 'Save Supplier';
    form.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // Fallback: try to fetch single supplier by id
  try {
    const s = await fetchJSON(`/supplies/${id}`);
    if (!s) return alert('Supplier data not available');
    document.getElementById('supplier-name').value = s.name || '';
    document.getElementById('supplier-contact').value = s.contact || '';
    editingSupplierId = id;
    const form = document.getElementById('supplier-form');
    if (form) form.querySelector('button[type="submit"]').textContent = 'Save Supplier';
    form.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Edit supplier failed:', err);
    if (err.message && err.message.includes('HTTP 404')) {
      alert('Supplier not retrievable by id from server. Refresh the Suppliers list and try editing again.');
    } else {
      alert('Failed to load supplier for edit: ' + err.message);
    }
  }
}

async function deleteSupplier(id) {
  if (!id) return alert('Cannot determine supplier id to delete');
  if (!confirm('Delete this supplier?')) return;
  try {
    await fetchJSON(`/supplies/${id}`, { method: 'DELETE' });
    await loadSuppliers();
  } catch (err) {
    console.error('Delete supplier failed:', err);
    alert('Failed to delete supplier: ' + err.message);
  }
}

// ---------- Orders ----------
let editingOrderId = null;

async function loadProductsForOrder() {
  const selects = document.querySelectorAll(".product-id");
  if (selects.length === 0) return;
  try {
    const products = await fetchJSON("/products");
    selects.forEach(select => {
      const currentValue = select.value;
      const defaultOpt = select.querySelector('option[value=""]');
      select.innerHTML = "";
      if (defaultOpt) select.appendChild(defaultOpt);
      (products || []).forEach(p => {
        const opt = document.createElement("option");
        const id = getId(p);
        opt.value = id;
        opt.textContent = `${p.name || p.sku || id} (${p.sku || ""})`;
        select.appendChild(opt);
      });
      if (currentValue) select.value = currentValue;
    });
  } catch (err) {
    console.error("Failed to load products for order:", err);
  }
}

async function loadOrders() {
  const tableBody = document.querySelector("#order-table tbody");
  if (!tableBody) return;
  try {
    const orders = await fetchJSON("/orders");
    // populate orders cache
    (orders || []).forEach(o => {
      const oid = getId(o);
      if (oid) ordersCache[oid] = o;
    });
    tableBody.innerHTML = "";
    (orders || []).forEach((o) => {
      const tr = document.createElement("tr");
      const itemsText = (o.items || []).map(it => _formatOrderItem(it)).join("; ");
      const supplierText = _formatSupplierField(o);
      const oid = getId(o) || '';
      tr.innerHTML = `
        <td>${oid}</td>
        <td>${itemsText}</td>
        <td>${supplierText}</td>
        <td>${o.status || ""}</td>
        <td>
          <button class="edit-order">Edit</button>
          <button class="delete-order">Delete</button>
        </td>
      `;
      const editBtn = tr.querySelector('.edit-order');
      const deleteBtn = tr.querySelector('.delete-order');
      editBtn.addEventListener('click', () => editOrder(getId(o)));
      deleteBtn.addEventListener('click', () => deleteOrder(getId(o)));
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Failed to load orders:", err);
    tableBody.innerHTML = `<tr><td colspan=4>Error loading orders</td></tr>`;
  }
}

async function addOrder(e) {
  e.preventDefault();
  const rows = Array.from(document.querySelectorAll(".item-row"));
  const items = rows.map(r => ({
    productId: r.querySelector(".product-id").value.trim(),
    qty: Number(r.querySelector(".qty").value),
    price: Number(r.querySelector(".price").value)
  }));
  const supplierId = document.getElementById("order-supplierId").value;
  const status = document.getElementById("order-status").value;
  
  // Validation
  if (items.length === 0 || !items[0].productId) {
    alert("At least one item with a Product ID is required");
    return;
  }
  if (items[0].qty <= 0 || isNaN(items[0].qty)) {
    alert("Quantity must be a positive number");
    return;
  }
  if (!supplierId) {
    alert("Supplier is required");
    return;
  }
  if (!status) {
    alert("Status is required");
    return;
  }
  
  try {
    if (editingOrderId) {
      const updated = await fetchJSON(`/orders/${editingOrderId}`, { method: 'PUT', body: { items, supplierId, status } });
      editingOrderId = null;
      const form = document.getElementById('order-form');
      if (form) form.querySelector('button[type="submit"]').textContent = 'Add Order';
      alert("Order updated successfully!");
      // update cache entry if present
      if (updated && getId(updated)) ordersCache[getId(updated)] = updated;
    } else {
      const created = await fetchJSON("/orders", { method: "POST", body: { items, supplierId, status } });
      alert("Order added successfully!" + (created && (getId(created) || created._id) ? ` ID: ${getId(created) || created._id}` : ''));
      // add to cache if backend returned the created object
      if (created && getId(created)) ordersCache[getId(created)] = created;
    }
    e.target.reset();
    await loadOrders();
  } catch (err) {
    console.error("Add order failed:", err);
    alert("Failed to add order: " + err.message);
  }
}

async function editOrder(id) {
  // Use cached order if available (backend may not support GET /orders/:id)
  const cached = ordersCache[id];
  if (cached) {
    const o = cached;
    const firstRow = document.querySelector('.item-row');
    if (firstRow && o.items && o.items[0]) {
      // product-id is a <select>, value should be the product id
      const prodVal = getId(o.items[0].product || o.items[0].productId || o.items[0]);
      const prodSelect = firstRow.querySelector('.product-id');
      if (prodSelect) prodSelect.value = prodVal || '';
      firstRow.querySelector('.qty').value = o.items[0].qty || o.items[0].quantity || '';
      firstRow.querySelector('.price').value = o.items[0].price || '';
    }
    if (document.getElementById('order-supplierId')) document.getElementById('order-supplierId').value = o.supplierId || o.supplier || o.supplierName || '';
    if (document.getElementById('order-status')) document.getElementById('order-status').value = o.status || '';
    editingOrderId = id;
    const form = document.getElementById('order-form');
    if (form) form.querySelector('button[type="submit"]').textContent = 'Save Order';
    form.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // Fallback: try to fetch single order by id (may 404)
  try {
    const o = await fetchJSON(`/orders/${id}`);
    if (!o) return alert('Order data not available');
    const firstRow = document.querySelector('.item-row');
    if (firstRow && o.items && o.items[0]) {
      const prodVal = getId(o.items[0].product || o.items[0].productId || o.items[0]);
      const prodSelect = firstRow.querySelector('.product-id');
      if (prodSelect) prodSelect.value = prodVal || '';
      firstRow.querySelector('.qty').value = o.items[0].qty || o.items[0].quantity || '';
      firstRow.querySelector('.price').value = o.items[0].price || '';
    }
    if (document.getElementById('order-supplierId')) document.getElementById('order-supplierId').value = o.supplierId || o.supplier || o.supplierName || '';
    if (document.getElementById('order-status')) document.getElementById('order-status').value = o.status || '';
    editingOrderId = id;
    const form = document.getElementById('order-form');
    if (form) form.querySelector('button[type="submit"]').textContent = 'Save Order';
    form.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Edit order failed:', err);
    if (err.message && err.message.includes('HTTP 404')) {
      alert('Order not retrievable by id from server. Refresh the Orders list and try editing again.');
    } else {
      alert('Failed to load order for edit: ' + err.message);
    }
  }
}

async function deleteOrder(id) {
  if (!id) return alert('Cannot determine order id to delete');
  if (!confirm('Delete this order?')) return;
  try {
    await fetchJSON(`/orders/${id}`, { method: 'DELETE' });
    // remove from cache and reload list
    if (ordersCache[id]) delete ordersCache[id];
    await loadOrders();
  } catch (err) {
    console.error('Delete order failed:', err);
    alert('Failed to delete order: ' + err.message);
  }
}

// ---------- Initialization ----------
async function init() {
  // Products
  const productForm = document.getElementById("product-form");
  if (productForm) {
    productForm.addEventListener("submit", addProduct);
    await loadProducts();
  }

  // Suppliers
  const supplierForm = document.getElementById("supplier-form");
  if (supplierForm) {
    supplierForm.addEventListener("submit", addSupplier);
    await loadSuppliers();
  } else {
    // even if not on suppliers page, populate supplier select on orders page
    await loadSuppliers();
  }

  // Orders
  const orderForm = document.getElementById("order-form");
  if (orderForm) {
    await loadProductsForOrder();
    orderForm.addEventListener("submit", addOrder);
    await loadOrders();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => console.error("Init error:", err));
});

/*
Notes / Troubleshooting:
- Ensure your backend allows CORS from the frontend origin (or run pages from same origin).
- If your backend paths differ (e.g. `/api/products`), update `API_BASE` or the fetch paths accordingly.
- If your backend uses a different identifier than `id/_id/sku`, adjust `getId` helper.
*/
