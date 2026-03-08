const router = require('express').Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { requireAuth, requireAdmin } = require('../middleware/auth');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'craftstore',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', requireAuth, requireAdmin, upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided.' });
    res.json({ url: req.file.path, message: 'Image uploaded successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
```

Save and close. Now add the upload route to the server:
```
notepad backend/server.js
```

Find this line:
```
app.use('/api/users',    require('./routes/users'));
```

And add this line right after it:
```
app.use('/api/upload',   require('./routes/upload'));
```

Save and close. Now update the frontend to show an image upload button:
```
notepad frontend/src/App.jsx
```

Press **Ctrl+H** and do this replacement:

**Find:**
```
const ProductForm = ({ product, onSave, onCancel }) => {
  const CATS = ["Ceramics","Textiles","Candles","Stationery","Wellness","Home Decor","Accessories","Food & Pantry","Kitchen"];
  const [form, setForm] = useState({ name: product?.name||"", category: product?.category||"Ceramics", price: product?.price||"", stock: product?.stock||"", description: product?.description||"", image: product?.image||"??", sku: product?.sku||"", is_active: product?.is_active??1, id: product?.id });
  const [error, setError] = useState("");
```

**Replace with:**
```
const ProductForm = ({ product, onSave, onCancel }) => {
  const CATS = ["Ceramics","Textiles","Candles","Stationery","Wellness","Home Decor","Accessories","Food & Pantry","Kitchen"];
  const [form, setForm] = useState({ name: product?.name||"", category: product?.category||"Ceramics", price: product?.price||"", stock: product?.stock||"", description: product?.description||"", image: product?.image||"??", sku: product?.sku||"", is_active: product?.is_active??1, id: product?.id });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [useUrl, setUseUrl] = useState(!EMOJIS.includes(product?.image));

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('craft_token');
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(f => ({ ...f, image: data.url }));
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };
```

Now find this section in the same file:
```
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 8 }}>Emoji Icon</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {EMOJIS.map(em => <button key={em} onClick={() => setForm({...form,image:em})} style={{ width: 40, height: 40, fontSize: 22, border: `2px solid ${form.image===em?"var(--terra)":"var(--border)"}`, borderRadius: 6, background: form.image===em?"var(--beige-dark)":"white", cursor: "pointer" }}>{em}</button>)}
          </div>
        </div>
```

Replace it with:
```
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 8 }}>Product Image</label>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <button onClick={() => setUseUrl(false)} style={{ padding: "6px 16px", borderRadius: 20, border: "1.5px solid", borderColor: !useUrl?"var(--terra)":"var(--border)", background: !useUrl?"var(--terra)":"white", color: !useUrl?"white":"var(--text)", fontSize: 13, cursor: "pointer" }}>Emoji</button>
            <button onClick={() => setUseUrl(true)} style={{ padding: "6px 16px", borderRadius: 20, border: "1.5px solid", borderColor: useUrl?"var(--terra)":"var(--border)", background: useUrl?"var(--terra)":"white", color: useUrl?"white":"var(--text)", fontSize: 13, cursor: "pointer" }}>Upload Photo</button>
          </div>
          {!useUrl ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {EMOJIS.map(em => <button key={em} onClick={() => setForm({...form,image:em})} style={{ width: 40, height: 40, fontSize: 22, border: `2px solid ${form.image===em?"var(--terra)":"var(--border)"}`, borderRadius: 6, background: form.image===em?"var(--beige-dark)":"white", cursor: "pointer" }}>{em}</button>)}
            </div>
          ) : (
            <div>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} id="image-upload"/>
              <label htmlFor="image-upload" style={{ display: "inline-block", padding: "10px 20px", background: "var(--beige)", border: "1.5px dashed var(--border)", borderRadius: 8, cursor: "pointer", fontSize: 14, color: "var(--text-muted)" }}>
                {uploading ? "Uploading..." : "Click to choose a photo"}
              </label>
              {form.image && !EMOJIS.includes(form.image) && (
                <div style={{ marginTop: 12 }}>
                  <img src={form.image} alt="Preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}/>
                </div>
              )}
            </div>
          )}
        </div>
```

Save and close. Now also update the product card and detail page to show real images. Open App.jsx again and find:

**Find:**
```
      <div onClick={() => navigate("product", { id: product.id })} style={{ background: "var(--beige)", height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72 }}>{product.image}</div>
```

**Replace with:**
```
      <div onClick={() => navigate("product", { id: product.id })} style={{ background: "var(--beige)", height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, overflow: "hidden" }}>
        {product.image?.startsWith("http") ? <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : product.image}
      </div>
```

And find:
```
          <div style={{ background: "var(--beige)", borderRadius: 16, height: 420, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 140, border: "1px solid var(--border)" }}>{product.image}</div>
```

Replace with:
```
          <div style={{ background: "var(--beige)", borderRadius: 16, height: 420, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 140, border: "1px solid var(--border)", overflow: "hidden" }}>
            {product.image?.startsWith("http") ? <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }}/> : product.image}
          </div>
```

Save and close. Now push everything:
```
git add .
git commit -m "Add image upload support"
git push