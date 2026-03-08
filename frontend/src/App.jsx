// frontend/src/App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The Crafted Nest — Full React frontend wired to Express/SQLite backend
// Uses /api/* endpoints via Vite proxy (or direct in production)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useContext, createContext, useCallback, useRef } from "react";
import * as api from "./api.js";

// ============================================================
// GLOBAL STYLES
// ============================================================
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --beige: #F5EFE6; --beige-dark: #EDE3D5; --beige-mid: #D9CFC2;
      --sage: #8A9E85; --sage-light: #B5C5B1; --sage-dark: #5E7259;
      --terra: #C4714A; --terra-light: #D9967A; --terra-dark: #9E4F2E;
      --brown: #5C4033; --brown-light: #8B6355; --cream: #FDFAF5;
      --text: #3A2E27; --text-muted: #8B7B72; --border: #D9CFC2;
      --shadow: rgba(58,46,39,0.08); --shadow-md: rgba(58,46,39,0.15);
      --font-serif: 'Cormorant Garamond', Georgia, serif;
      --font-sans: 'DM Sans', system-ui, sans-serif;
      --radius: 4px; --radius-lg: 12px;
    }
    html { scroll-behavior: smooth; }
    body { font-family: var(--font-sans); background: var(--cream); color: var(--text); line-height: 1.6; -webkit-font-smoothing: antialiased; }
    h1,h2,h3,h4 { font-family: var(--font-serif); font-weight: 400; line-height: 1.2; }
    button { cursor: pointer; font-family: var(--font-sans); }
    input,select,textarea { font-family: var(--font-sans); }
    a { color: inherit; text-decoration: none; }
    .btn-primary { background: var(--terra); color: white; border: none; padding: 12px 28px; font-size: 14px; font-weight: 500; letter-spacing: 0.05em; border-radius: var(--radius); transition: all 0.2s ease; }
    .btn-primary:hover:not(:disabled) { background: var(--terra-dark); transform: translateY(-1px); }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
    .btn-outline { background: transparent; color: var(--terra); border: 1.5px solid var(--terra); padding: 11px 28px; font-size: 14px; font-weight: 500; letter-spacing: 0.05em; border-radius: var(--radius); transition: all 0.2s ease; }
    .btn-outline:hover { background: var(--terra); color: white; }
    .btn-ghost { background: transparent; color: var(--text); border: 1.5px solid var(--border); padding: 10px 20px; font-size: 13px; border-radius: var(--radius); transition: all 0.2s ease; }
    .btn-ghost:hover { border-color: var(--terra); color: var(--terra); }
    .btn-danger { background: #C0392B; color: white; border: none; padding: 8px 16px; font-size: 13px; border-radius: var(--radius); transition: all 0.2s ease; }
    .btn-danger:hover { background: #A93226; }
    .input-field { width: 100%; padding: 11px 14px; border: 1.5px solid var(--border); border-radius: var(--radius); font-size: 14px; background: white; color: var(--text); transition: border-color 0.2s; outline: none; }
    .input-field:focus { border-color: var(--terra); }
    .input-field::placeholder { color: var(--text-muted); }
    .card { background: white; border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; letter-spacing: 0.04em; }
    .badge-green { background: #E8F5E8; color: #2E7D32; }
    .badge-red { background: #FDECEA; color: #C0392B; }
    .badge-orange { background: #FFF3E0; color: #E65100; }
    .badge-blue { background: #E3F2FD; color: #1565C0; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: var(--beige); } ::-webkit-scrollbar-thumb { background: var(--beige-mid); border-radius: 3px; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    .fade-in { animation: fadeIn 0.4s ease forwards; }
    .spinner { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--terra); border-radius: 50%; animation: spin 0.7s linear infinite; }
  `}</style>
);

// ============================================================
// CONTEXT & STATE
// ============================================================
const AppContext = createContext(null);

const AppProvider = ({ children }) => {
  const [page, setPage] = useState("home");
  const [pageData, setPageData] = useState({});
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("craft_cart") || "[]"); } catch { return []; }
  });
  const [toast, setToast] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  // Persist cart
  useEffect(() => { localStorage.setItem("craft_cart", JSON.stringify(cart)); }, [cart]);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      if (!api.token.exists()) { setAuthLoading(false); return; }
      try {
        const { user } = await api.auth.me();
        setUser(user);
      } catch { api.token.clear(); }
      finally { setAuthLoading(false); }
    };
    restore();
  }, []);

  const navigate = (p, data = {}) => { setPage(p); setPageData(data); window.scrollTo(0, 0); };
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const login = async (email, password) => {
    const data = await api.auth.login(email, password);
    api.token.save(data.token);
    setUser(data.user);
    showToast(`Welcome back, ${data.user.name}!`);
    return data.user;
  };

  const register = async (name, email, password) => {
    const data = await api.auth.register(name, email, password);
    api.token.save(data.token);
    setUser(data.user);
    showToast(data.message || `Welcome, ${data.user.name}!`);
    return data.user;
  };

  const logout = () => {
    api.token.clear();
    setUser(null);
    navigate("home");
    showToast("Logged out successfully.", "info");
  };

  const addToCart = (product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: Math.min(i.qty + qty, product.stock) } : i);
      return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, stock: product.stock, qty }];
    });
    showToast(`${product.name} added to cart!`);
  };
  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const updateCartQty = (id, qty) => { if (qty < 1) { removeFromCart(id); return; } setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i)); };
  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <AppContext.Provider value={{ page, pageData, navigate, user, authLoading, login, register, logout, cart, cartOpen, setCartOpen, addToCart, removeFromCart, updateCartQty, clearCart, cartTotal, cartCount, showToast, toast }}>
      {children}
    </AppContext.Provider>
  );
};

const useApp = () => useContext(AppContext);

// ============================================================
// ICONS
// ============================================================
const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const icons = {
    cart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3c-.4.4-.1 1.1.6 1.1H17m0 0a2 2 0 100 4 2 2 0 000-4zm-10 2a2 2 0 100 4 2 2 0 000-4z" />,
    search: <><circle cx="11" cy="11" r="7" strokeWidth={1.8}/><path strokeLinecap="round" strokeWidth={1.8} d="m21 21-4.4-4.4"/></>,
    user: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>,
    x: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 6L6 18M6 6l12 12"/>,
    plus: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v14M5 12h14"/>,
    minus: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14"/>,
    trash: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>,
    edit: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11.8 15H9v-2.8l9.6-9.6z"/>,
    star: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.8l-6.2 3.2 1.2-6.8L2 9.3l6.9-1z"/>,
    arrow_left: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5m7-7-7 7 7 7"/>,
    package: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4a2 2 0 001-1.7z"/>,
    users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8 8v-2a4 4 0 00-3-3.87m-1-7.13a4 4 0 010 7.75"/>,
    grid: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>,
    leaf: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 8C8 10 5.9 16.2 3 22c3-1 4.5-4 6.5-6C11 13.5 14 11 17 8zm0 0c1-2 2-4 2-8-4 0-6 1-8 2"/>,
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10"/>,
    logout: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>,
    check: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>,
    refresh: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}>{icons[name]}</svg>;
};

// ============================================================
// TOAST
// ============================================================
const Toast = () => {
  const { toast } = useApp();
  if (!toast) return null;
  const bg = toast.type === "success" ? "var(--sage-dark)" : toast.type === "error" ? "#C0392B" : "var(--brown)";
  return <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: bg, color: "white", padding: "14px 22px", borderRadius: 8, fontSize: 14, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", animation: "fadeIn 0.3s ease", maxWidth: 340 }}>{toast.msg}</div>;
};

// ============================================================
// CART SIDEBAR
// ============================================================
const CartSidebar = () => {
  const { cartOpen, setCartOpen, cart, removeFromCart, updateCartQty, cartTotal, navigate } = useApp();
  if (!cartOpen) return null;
  return (
    <>
      <div onClick={() => setCartOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px,100vw)", background: "var(--cream)", zIndex: 1001, display: "flex", flexDirection: "column", animation: "slideIn 0.3s ease", boxShadow: "-4px 0 30px var(--shadow-md)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22 }}>Your Cart ({cart.length})</h3>
          <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none", padding: 4 }}><Icon name="x" size={22}/></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>Your cart is empty</p>
            </div>
          ) : cart.map(item => (
            <div key={item.id} style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--beige)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{item.image}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                <p style={{ color: "var(--terra)", fontWeight: 500, fontSize: 14 }}>₹{item.price}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <button onClick={() => updateCartQty(item.id, item.qty - 1)} style={{ width: 26, height: 26, border: "1.5px solid var(--border)", borderRadius: 4, background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="minus" size={12}/></button>
                  <span style={{ fontSize: 14, fontWeight: 500, minWidth: 20, textAlign: "center" }}>{item.qty}</span>
                  <button onClick={() => updateCartQty(item.id, item.qty + 1)} style={{ width: 26, height: 26, border: "1.5px solid var(--border)", borderRadius: 4, background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={12}/></button>
                  <button onClick={() => removeFromCart(item.id)} style={{ background: "none", border: "none", marginLeft: "auto", padding: 4 }}><Icon name="trash" size={15} color="var(--text-muted)"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border)", background: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 16 }}>
              <span style={{ fontFamily: "var(--font-serif)" }}>Subtotal</span>
              <span style={{ fontWeight: 600, color: "var(--terra)" }}>₹{cartTotal.toFixed(2)}</span>
            </div>
            <button className="btn-primary" style={{ width: "100%" }} onClick={() => { setCartOpen(false); navigate("checkout"); }}>Proceed to Checkout</button>
          </div>
        )}
      </div>
    </>
  );
};

// ============================================================
// NAVBAR
// ============================================================
const Navbar = () => {
  const { navigate, user, logout, cartCount, setCartOpen, page } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav style={{ background: "var(--cream)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(8px)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate("home")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="leaf" size={22} color="var(--sage-dark)"/>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500 }}>The Crafted Nest</span>
        </button>
        <div style={{ display: "flex", gap: 28 }}>
          {[["home","Shop"],["about","About"]].map(([p,label]) => (
            <button key={p} onClick={() => navigate(p)} style={{ background: "none", border: "none", fontSize: 14, color: page===p?"var(--terra)":"var(--text)", fontWeight: page===p?500:400 }}>{label}</button>
          ))}
          {user?.role === "admin" && (
            <button onClick={() => navigate("admin")} style={{ background: "none", border: "none", fontSize: 14, color: page==="admin"?"var(--terra)":"var(--text)", fontWeight: page==="admin"?500:400 }}>Admin</button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {user ? (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", padding: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--terra)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{user.name[0]}</div>
              </button>
              {menuOpen && (
                <div style={{ position: "absolute", top: "100%", right: 0, background: "white", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 8px 24px var(--shadow-md)", minWidth: 180, overflow: "hidden", zIndex: 200 }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{user.email}</p>
                  </div>
                  <button onClick={() => { navigate("orders"); setMenuOpen(false); }} style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", textAlign: "left", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><Icon name="package" size={15}/> My Orders</button>
                  {user.role === "admin" && <button onClick={() => { navigate("admin"); setMenuOpen(false); }} style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", textAlign: "left", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><Icon name="grid" size={15}/> Admin Panel</button>}
                  <button onClick={() => { logout(); setMenuOpen(false); }} style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", textAlign: "left", fontSize: 13, color: "#C0392B", display: "flex", alignItems: "center", gap: 8 }}><Icon name="logout" size={15} color="#C0392B"/> Logout</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate("login")} style={{ background: "none", border: "none", padding: 10 }}><Icon name="user" size={20}/></button>
          )}
          <button onClick={() => setCartOpen(true)} style={{ background: "none", border: "none", padding: 10, position: "relative" }}>
            <Icon name="cart" size={20}/>
            {cartCount > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: "var(--terra)", color: "white", borderRadius: "50%", width: 17, height: 17, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>}
          </button>
        </div>
      </div>
    </nav>
  );
};

// ============================================================
// HOME PAGE
// ============================================================
const HomePage = () => {
  const { addToCart, navigate } = useApp();
  const [productData, setProductData] = useState({ products: [], pagination: {} });
  const [categories, setCategories] = useState(["All"]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const searchTimeout = useRef(null);

  useEffect(() => { api.products.categories().then(d => setCategories(d.categories)).catch(() => {}); }, []);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setLoading(true);
      api.products.list({ search, category: category === "All" ? "" : category }).then(d => {
        setProductData(d);
        setLoading(false);
      }).catch(() => setLoading(false));
    }, 300);
  }, [search, category]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg, var(--beige) 0%, var(--beige-dark) 100%)", padding: "60px 20px 50px", textAlign: "center", borderBottom: "1px solid var(--border)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 20, right: 60, fontSize: 80, opacity: 0.08 }}>🌿</div>
        <div style={{ position: "absolute", bottom: 10, left: 60, fontSize: 60, opacity: 0.07 }}>🍃</div>
        <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--sage-dark)", fontWeight: 500, marginBottom: 16 }}>Handmade with Love</p>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 58px)", marginBottom: 18, fontWeight: 300, fontStyle: "italic" }}>Crafted for the<br/>Mindful Home</h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 32 }}>Discover unique handcrafted goods made by artisans who pour their heart into every piece.</p>
          <div style={{ position: "relative", maxWidth: 440, margin: "0 auto" }}>
            <input className="input-field" placeholder="Search ceramics, candles, textiles..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 44, height: 48, fontSize: 15, borderRadius: 24, boxShadow: "0 2px 12px var(--shadow)" }} />
            <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={18} color="var(--text-muted)"/></div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 0" }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={{ flexShrink: 0, padding: "7px 16px", borderRadius: 20, border: "1.5px solid", borderColor: category===cat?"var(--terra)":"var(--border)", background: category===cat?"var(--terra)":"white", color: category===cat?"white":"var(--text)", fontSize: 13, fontWeight: 500, transition: "all 0.2s", whiteSpace: "nowrap" }}>{cat}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 60px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}><div className="spinner"/></div>
        ) : productData.products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: 22 }}>No products found</p>
          </div>
        ) : (
          <>
            {search && <p style={{ marginBottom: 20, fontSize: 14, color: "var(--text-muted)" }}>{productData.pagination.total} result{productData.pagination.total !== 1 ? "s" : ""} for "{search}"</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
              {productData.products.map(product => <ProductCard key={product.id} product={product}/>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ProductCard = ({ product }) => {
  const { navigate, addToCart } = useApp();
  return (
    <div className="card fade-in" style={{ cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px var(--shadow-md)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
      <div onClick={() => navigate("product", { id: product.id })} style={{ background: "var(--beige)", height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, overflow:"hidden" }}>{product.image?.startsWith("http") ? <img src={product.image} alt={product.name} style={{ wi
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 11, color: "var(--sage-dark)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{product.category}</p>
        <h3 onClick={() => navigate("product", { id: product.id })} style={{ fontFamily: "var(--font-serif)", fontSize: 18, marginBottom: 8, lineHeight: 1.3 }}>{product.name}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
          <Icon name="star" size={13} color="#F59E0B"/>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{Number(product.rating).toFixed(1)} ({product.review_count})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: "var(--terra)", fontFamily: "var(--font-serif)" }}>₹{product.price}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="tag" style={{ background: product.stock>0?"#E8F5E8":"#FDECEA", color: product.stock>0?"#2E7D32":"#C0392B" }}>{product.stock>0?`${product.stock} left`:"Sold out"}</span>
            <button onClick={() => product.stock > 0 && addToCart(product)} className="btn-primary" style={{ padding: "7px 14px", fontSize: 12, opacity: product.stock===0?0.5:1 }} disabled={product.stock===0}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PRODUCT DETAIL
// ============================================================
const ProductPage = () => {
  const { pageData, navigate, addToCart } = useApp();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!pageData.id) { navigate("home"); return; }
    setLoading(true);
    api.products.get(pageData.id).then(d => { setProduct(d.product); setLoading(false); }).catch(() => { navigate("home"); });
  }, [pageData.id]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "100px 0" }}><div className="spinner"/></div>;
  if (!product) return null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 80px" }}>
      <button onClick={() => navigate("home")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--text-muted)", marginBottom: 32 }}><Icon name="arrow_left" size={16}/> Back to Shop</button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "start" }}>
        <div>
          <div style={{ background: "var(--beige)", borderRadius: 16, height: 420, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 140, border: "1px solid var(--border)", overflow:"hidden" }}>{product.image?.startsWith("http") ? <img src={product.i
        </div>
        <div className="fade-in">
          <p style={{ fontSize: 12, color: "var(--sage-dark)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{product.category}</p>
          <h1 style={{ fontSize: 38, marginBottom: 12, fontWeight: 300 }}>{product.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            {[1,2,3,4,5].map(s => <Icon key={s} name="star" size={16} color={s<=Math.floor(product.rating)?"#F59E0B":"#E5E7EB"}/>)}
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{Number(product.rating).toFixed(1)} · {product.review_count} reviews</span>
          </div>
          <p style={{ fontSize: 36, fontFamily: "var(--font-serif)", color: "var(--terra)", marginBottom: 24 }}>₹{product.price}</p>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", marginBottom: 28 }}>{product.description}</p>
          <div style={{ padding: 16, background: "var(--beige)", borderRadius: 8, marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><span>SKU:</span><span style={{ fontWeight: 500 }}>{product.sku}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Stock:</span><span className="tag" style={{ background: product.stock>0?"#E8F5E8":"#FDECEA", color: product.stock>0?"#2E7D32":"#C0392B" }}>{product.stock>0?`In Stock (${product.stock})`:"Out of Stock"}</span></div>
          </div>
          {product.stock > 0 && (
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", border: "1.5px solid var(--border)", borderRadius: 4 }}>
                <button onClick={() => setQty(Math.max(1, qty-1))} style={{ width: 40, height: 44, background: "white", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="minus" size={14}/></button>
                <span style={{ width: 44, textAlign: "center", fontWeight: 500 }}>{qty}</span>
                <button onClick={() => setQty(Math.min(product.stock, qty+1))} style={{ width: 40, height: 44, background: "white", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={14}/></button>
              </div>
              <button className="btn-primary" style={{ flex: 1, height: 44 }} onClick={() => addToCart(product, qty)}>Add to Cart — ₹{(product.price * qty).toFixed(2)}</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-muted)", flexWrap: "wrap" }}>
            <span>🌿 Sustainably made</span><span>📦 Free shipping over ₹75</span><span>↩️ 30-day returns</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// AUTH PAGES
// ============================================================
const AuthBox = ({ children, title, subtitle }) => (
  <div style={{ minHeight: "calc(100vh - 66px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: "var(--beige)" }}>
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <Icon name="leaf" size={32} color="var(--sage-dark)"/>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, marginTop: 12, fontWeight: 300 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>{subtitle}</p>}
      </div>
      <div className="card" style={{ padding: 32 }}>{children}</div>
    </div>
  </div>
);

const LoginPage = () => {
  const { login, navigate } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "admin" ? "admin" : "home");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <AuthBox title="Welcome Back" subtitle="Sign in to your account">
      {error && <div style={{ background: "#FDECEA", color: "#C0392B", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 20 }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Email</label><input className="input-field" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}/></div>
        <div><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Password</label><input className="input-field" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}/></div>
        <button onClick={() => navigate("forgot")} style={{ background: "none", border: "none", textAlign: "right", fontSize: 13, color: "var(--terra)" }}>Forgot password?</button>
        <button className="btn-primary" style={{ width: "100%" }} onClick={handleLogin} disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Don't have an account? <button onClick={() => navigate("register")} style={{ background: "none", border: "none", color: "var(--terra)", fontWeight: 500 }}>Register</button></div>
        <div style={{ background: "var(--beige)", borderRadius: 6, padding: 12, fontSize: 12, color: "var(--text-muted)" }}>
          <strong>Demo accounts:</strong><br/>Admin: admin@craftstore.com / admin123<br/>Customer: jane@example.com / pass123
        </div>
      </div>
    </AuthBox>
  );
};

const RegisterPage = () => {
  const { register, navigate } = useApp();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");
    if (!form.name || !form.email || !form.password) { setError("Please fill in all fields."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try { await register(form.name, form.email, form.password); navigate("home"); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <AuthBox title="Create Account" subtitle="Join our community of craft lovers">
      {error && <div style={{ background: "#FDECEA", color: "#C0392B", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 20 }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[["name","Full Name","text","Jane Smith"],["email","Email","email","your@email.com"],["password","Password","password","Min. 6 characters"],["confirm","Confirm Password","password","Repeat password"]].map(([key,label,type,ph]) => (
          <div key={key}><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>{label}</label><input className="input-field" type={type} placeholder={ph} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})}/></div>
        ))}
        <button className="btn-primary" style={{ width: "100%" }} onClick={handleRegister} disabled={loading}>{loading ? "Creating..." : "Create Account"}</button>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Already have an account? <button onClick={() => navigate("login")} style={{ background: "none", border: "none", color: "var(--terra)", fontWeight: 500 }}>Sign In</button></div>
      </div>
    </AuthBox>
  );
};

const ForgotPage = () => {
  const { navigate } = useApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!email) return;
    setLoading(true); setError("");
    try { await api.auth.forgotPassword(email); setSent(true); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <AuthBox title="Reset Password" subtitle="We'll send you a reset link">
      {!sent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <div style={{ background: "#FDECEA", color: "#C0392B", padding: "10px 14px", borderRadius: 6, fontSize: 13 }}>{error}</div>}
          <div><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Email Address</label><input className="input-field" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}/></div>
          <button className="btn-primary" style={{ width: "100%" }} onClick={handleSend} disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
          <button onClick={() => navigate("login")} style={{ background: "none", border: "none", textAlign: "center", fontSize: 13, color: "var(--terra)" }}>Back to Login</button>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, marginBottom: 12 }}>Check your inbox</p>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>A reset link was sent to {email}. Check the server console in development mode.</p>
          <button className="btn-outline" onClick={() => navigate("login")}>Back to Login</button>
        </div>
      )}
    </AuthBox>
  );
};

// ============================================================
// CHECKOUT
// ============================================================
const CheckoutPage = () => {
  const { user, cart, cartTotal, navigate, clearCart, showToast } = useApp();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: user?.name||"", email: user?.email||"", phone: "", address: "", city: "", state: "", zip: "", notes: "" });
  const [orderId, setOrderId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!user) return <div style={{ maxWidth: 500, margin: "80px auto", padding: "40px 20px", textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div><h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, marginBottom: 16 }}>Sign in to Checkout</h2><button className="btn-primary" onClick={() => navigate("login")}>Sign In</button></div>;
  if (cart.length === 0 && !orderId) return <div style={{ maxWidth: 500, margin: "80px auto", padding: "40px 20px", textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 20 }}>🛒</div><h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, marginBottom: 16 }}>Your cart is empty</h2><button className="btn-outline" onClick={() => navigate("home")}>Continue Shopping</button></div>;

  const handlePlaceOrder = async () => {
    setError(""); setLoading(true);
    try {
      const items = cart.map(i => ({ productId: i.id, quantity: i.qty }));
      const { order, message } = await api.orders.place(items, form);
      clearCart();
      setOrderId(order.id);
      setStep(3);
      showToast(message || `Order ${order.id} placed!`);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const tax = cartTotal * 0.08;
  const shipping = cartTotal >= 75 ? 0 : 8.99;
  const total = cartTotal + tax + shipping;
  const isStep1Valid = ["name","email","phone","address","city","state","zip"].every(f => form[f]?.trim());

  if (step === 3) return (
    <div style={{ maxWidth: 560, margin: "60px auto", padding: "40px 20px", textAlign: "center" }} className="fade-in">
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#E8F5E8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 36 }}>✅</div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 36, marginBottom: 12, fontWeight: 300 }}>Order Confirmed!</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 8 }}>Your order <strong>{orderId}</strong> has been placed.</p>
      <p style={{ color: "var(--text-muted)", marginBottom: 32, fontSize: 14 }}>A confirmation email was triggered to {form.email} 📧</p>
      <div className="card" style={{ padding: 24, marginBottom: 32, textAlign: "left" }}>
        <p style={{ fontWeight: 600, marginBottom: 12, fontFamily: "var(--font-serif)", fontSize: 18 }}>Payment: Cash on Delivery</p>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Please have the exact amount ready when your order arrives.</p>
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button className="btn-outline" onClick={() => navigate("orders")}>View My Orders</button>
        <button className="btn-primary" onClick={() => navigate("home")}>Continue Shopping</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px 80px" }}>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, marginBottom: 8, fontWeight: 300 }}>Checkout</h1>
      <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
        {[1,2].map(s => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: step>=s?"var(--terra)":"var(--beige-mid)", color: step>=s?"white":"var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{s}</div>
            <span style={{ fontSize: 14, color: step>=s?"var(--text)":"var(--text-muted)", fontWeight: step===s?500:400 }}>{s===1?"Shipping":"Review & Pay"}</span>
            {s < 2 && <span style={{ color: "var(--border)", marginLeft: 8 }}>—</span>}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>
        <div>
          {step === 1 && (
            <div className="card fade-in" style={{ padding: 28 }}>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, marginBottom: 24 }}>Shipping Information</h3>
              {error && <div style={{ background: "#FDECEA", color: "#C0392B", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[["name","Full Name","text","Jane Smith"],["phone","Phone","tel","+1 555 000-0000"]].map(([k,l,t,p]) => (
                    <div key={k}><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>{l}</label><input className="input-field" type={t} placeholder={p} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}/></div>
                  ))}
                </div>
                <div><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Email</label><input className="input-field" type="email" placeholder="your@email.com" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/></div>
                <div><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Street Address</label><input className="input-field" placeholder="123 Main Street" value={form.address} onChange={e => setForm({...form,address:e.target.value})}/></div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
                  {[["city","City","Portland"],["state","State","OR"],["zip","ZIP","97201"]].map(([k,l,p]) => (
                    <div key={k}><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>{l}</label><input className="input-field" placeholder={p} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}/></div>
                  ))}
                </div>
                <div style={{ background: "var(--beige)", borderRadius: 8, padding: 16, display: "flex", gap: 12 }}>
                  <div style={{ fontSize: 24 }}>💵</div>
                  <div><p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Cash on Delivery</p><p style={{ fontSize: 13, color: "var(--text-muted)" }}>This is the only available payment method.</p></div>
                </div>
                <button className="btn-primary" style={{ width: "100%", height: 46, opacity: isStep1Valid?1:0.5 }} disabled={!isStep1Valid} onClick={() => setStep(2)}>Continue to Review</button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="card fade-in" style={{ padding: 28 }}>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, marginBottom: 24 }}>Review Your Order</h3>
              {error && <div style={{ background: "#FDECEA", color: "#C0392B", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Shipping to</p>
                <p style={{ fontSize: 15 }}>{form.name}</p>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{form.address}, {form.city}, {form.state} {form.zip}</p>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>{form.phone} · {form.email}</p>
                <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "var(--terra)", fontSize: 13, marginTop: 6 }}>Edit</button>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Payment</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--beige)", borderRadius: 8, border: "2px solid var(--terra)" }}>
                  <span style={{ fontSize: 22 }}>💵</span><span style={{ fontWeight: 500 }}>Cash on Delivery</span>
                  <span className="tag badge-green" style={{ marginLeft: "auto" }}>✓ Selected</span>
                </div>
              </div>
              <div style={{ marginTop: 28, display: "flex", gap: 12 }}>
                <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
                <button className="btn-primary" style={{ flex: 1, height: 46 }} onClick={handlePlaceOrder} disabled={loading}>{loading ? "Placing order..." : `Place Order — ₹${total.toFixed(2)}`}</button>
              </div>
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 24, position: "sticky", top: 90 }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 20, marginBottom: 20 }}>Order Summary</h3>
          {cart.map(item => (
            <div key={item.id} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 6, background: "var(--beige)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{item.image}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Qty: {item.qty}</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500 }}>₹{(item.price*item.qty).toFixed(2)}</p>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
            {[["Subtotal",`₹${cartTotal.toFixed(2)}`],["Shipping",shipping===0?"Free":`₹${shipping.toFixed(2)}`],["Tax (8%)",`₹${tax.toFixed(2)}`]].map(([k,v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}><span style={{ color: "var(--text-muted)" }}>{k}</span><span>{v}</span></div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <span>Total</span><span style={{ color: "var(--terra)" }}>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ORDERS PAGE
// ============================================================
const OrdersPage = () => {
  const { user, navigate } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const statusColors = { pending:"badge-orange", processing:"badge-blue", shipped:"badge-blue", delivered:"badge-green", cancelled:"badge-red" };

  useEffect(() => {
    if (!user) { navigate("login"); return; }
    api.orders.myOrders().then(d => { setOrders(d.orders); setLoading(false); }).catch(() => setLoading(false));
  }, [user]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "100px 0" }}><div className="spinner"/></div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px 80px" }}>
      <button onClick={() => navigate("home")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--text-muted)", marginBottom: 28 }}><Icon name="arrow_left" size={16}/> Back to Shop</button>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, marginBottom: 32, fontWeight: 300 }}>My Orders</h1>
      {orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 22 }}>No orders yet</p>
          <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => navigate("home")}>Start Shopping</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {orders.map(order => (
            <div key={order.id} className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 16 }}>{order.id}</p>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{order.createdAt?.split("T")[0]} · Cash on Delivery</p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className={`tag ${statusColors[order.status]||"badge-orange"}`} style={{ textTransform: "capitalize" }}>{order.status}</span>
                  <span style={{ fontWeight: 700, color: "var(--terra)", fontSize: 16 }}>₹{order.total.toFixed(2)}</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                {order.items.map((item,i) => <p key={i} style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4 }}>{item.image} {item.name} × {item.quantity}</p>)}
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>📍 {order.shipping?.address}, {order.shipping?.city}, {order.shipping?.state}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// ADMIN DASHBOARD
// ============================================================
const AdminPage = () => {
  const { user, navigate, showToast } = useApp();
  const [tab, setTab] = useState("products");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    api.orders.stats().then(d => setStats(d)).catch(() => {});
  }, [user]);

  if (!user || user.role !== "admin") return (
    <div style={{ maxWidth: 500, margin: "80px auto", padding: "40px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🔒</div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28 }}>Admin Access Required</h2>
      <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => navigate("login")}>Sign In as Admin</button>
    </div>
  );

  const TABS = [["products","Products","package"],["orders","Orders","grid"],["users","Users","users"]];

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 66px)" }}>
      <div style={{ width: 220, background: "var(--brown)", color: "white", flexShrink: 0, padding: "28px 0" }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, marginBottom: 4 }}>Admin Panel</p>
          <p style={{ fontSize: 12, opacity: 0.6 }}>{user.name}</p>
        </div>
        <div style={{ padding: "16px 12px" }}>
          {TABS.map(([id,label,icon]) => (
            <button key={id} onClick={() => setTab(id)} style={{ width: "100%", padding: "12px 14px", background: tab===id?"rgba(255,255,255,0.12)":"none", border: "none", color: "white", textAlign: "left", borderRadius: 6, fontSize: 14, fontWeight: tab===id?500:400, display: "flex", alignItems: "center", gap: 10, marginBottom: 4, cursor: "pointer" }}>
              <Icon name={icon} size={16} color="white"/> {label}
            </button>
          ))}
          <button onClick={() => navigate("home")} style={{ width: "100%", padding: "12px 14px", background: "none", border: "none", color: "rgba(255,255,255,0.6)", textAlign: "left", borderRadius: 6, fontSize: 14, display: "flex", alignItems: "center", gap: 10, marginTop: 16, cursor: "pointer" }}>
            <Icon name="home" size={16} color="rgba(255,255,255,0.6)"/> Back to Store
          </button>
        </div>
      </div>
      <div style={{ flex: 1, padding: "32px 28px", background: "var(--beige)", overflowY: "auto" }}>
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            {[["Total Products",stats.productCount,"📦"],["Total Orders",stats.orderCount,"🛍️"],["Customers",stats.userCount,"👤"],["Revenue",`₹${Number(stats.totalRevenue).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,"💰"]].map(([label,val,emoji]) => (
              <div key={label} className="card" style={{ padding: "18px 20px" }}>
                <p style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</p>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 26 }}>{val}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</p>
              </div>
            ))}
          </div>
        )}
        {tab === "products" && <AdminProducts showToast={showToast}/>}
        {tab === "orders"   && <AdminOrders  showToast={showToast}/>}
        {tab === "users"    && <AdminUsers   showToast={showToast}/>}
      </div>
    </div>
  );
};

const EMOJIS = ["🍵","🧵","🕯️","📓","🌿","🧺","🎨","🌱","👜","🍯","🥄","🪔","🏺","🌸","🎁","🧶","🌾","🫙"];

const AdminProducts = ({ showToast }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    api.products.list({ admin: "true", limit: 100 }).then(d => { setProducts(d.products); setLoading(false); });
  };
  useEffect(load, []);

  const handleSave = async (form) => {
    try {
      if (form.id) await api.products.update(form.id, form);
      else await api.products.create(form);
      showToast(form.id ? "Product updated." : "Product added.");
      setShowForm(false); setEditProduct(null); load();
    } catch (e) { showToast(e.message, "error"); }
  };
  const handleDelete = async (id, name) => {
    if (!confirm(`Remove "${name}" from the store?`)) return;
    try { await api.products.delete(id); showToast("Product removed."); load(); }
    catch (e) { showToast(e.message, "error"); }
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 26 }}>Products</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={load} style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="refresh" size={14}/> Refresh</button>
          <button className="btn-primary" onClick={() => { setEditProduct(null); setShowForm(true); }}>+ Add Product</button>
        </div>
      </div>
      {showForm && <ProductForm product={editProduct} onSave={handleSave} onCancel={() => { setShowForm(false); setEditProduct(null); }}/>}
      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner"/></div> : (
        <div className="card" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "var(--beige)", textAlign: "left" }}>
              {["Product","Category","Price","Stock","Rating","Status","Actions"].map(h => <th key={h} style={{ padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24 }}>{p.image}</span>
                      <div><p style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</p><p style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.sku}</p></div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "var(--text-muted)" }}>{p.category}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "var(--terra)" }}>₹{p.price}</td>
                  <td style={{ padding: "12px 16px" }}><span className={`tag ${p.stock>0?"badge-green":"badge-red"}`}>{p.stock}</span></td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>⭐ {Number(p.rating).toFixed(1)}</td>
                  <td style={{ padding: "12px 16px" }}><span className={`tag ${p.is_active?"badge-green":"badge-red"}`}>{p.is_active?"Active":"Hidden"}</span></td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setEditProduct(p); setShowForm(true); }} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Icon name="edit" size={13}/> Edit</button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="btn-danger" style={{ padding: "6px 12px", fontSize: 12 }}><Icon name="trash" size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ProductForm = ({ product, onSave, onCancel }) => {
  const CATS = ["Ceramics","Textiles","Candles","Stationery","Wellness","Home Decor","Accessories","Food & Pantry","Kitchen"];
  const [form, setForm] = useState({ name: product?.name||"", category: product?.category||"Ceramics", price: product?.price||"", stock: product?.stock||"", description: product?.description||"", image: product?.image||"🎁", sku: product?.sku||"", is_active: product?.is_active??1, id: product?.id });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [useUrl, setUseUrl] = useState(product?.image?.startsWith("http")||false);

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

  const handleSave = async () => {
    if (!form.name||!form.price||!form.sku||!form.category) { setError("Name, price, SKU, and category are required."); return; }
    setError(""); onSave(form);
  };

  return (
    <div className="card fade-in" style={{ padding: 24, marginBottom: 24, borderLeft: "4px solid var(--terra)" }}>
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 20, marginBottom: 20 }}>{form.id?"Edit Product":"Add New Product"}</h3>
      {error && <div style={{ background: "#FDECEA", color: "#C0392B", padding: "10px 14px", borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[["name","Product Name","text","Hand-thrown Ceramic Mug"],["sku","SKU","text","CER-001"],["price","Price (₹)","number","999"],["stock","Stock","number","10"]].map(([k,l,t,p]) => (
          <div key={k}><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>{l}</label><input className="input-field" type={t} placeholder={p} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}/></div>
        ))}
        <div><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Category</label>
          <select className="input-field" value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
        </div>
        <div><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Status</label>
          <select className="input-field" value={form.is_active} onChange={e => setForm({...form,is_active:parseInt(e.target.value)})}><option value={1}>Active</option><option value={0}>Hidden</option></select>
        </div>
        <div style={{ gridColumn: "1/-1" }}><label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Description</label><textarea className="input-field" rows={3} value={form.description} onChange={e => setForm({...form,description:e.target.value})} style={{ resize: "vertical" }}/></div>
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
              <label htmlFor="image-upload" style={{ display: "inline-block", padding: "10px 20px", background: "var(--beige)", border: "1.5px dashed var(--border)", borderRadius: 8, cursor: uploading?"not-allowed":"pointer", fontSize: 14, color: "var(--text-muted)" }}>
                {uploading ? "⏳ Uploading..." : "📷 Click to choose a photo"}
              </label>
              {form.image?.startsWith("http") && (
                <div style={{ marginTop: 12 }}>
                  <img src={form.image} alt="Preview" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}/>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button className="btn-primary" onClick={handleSave}>Save Product</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

const AdminOrders = ({ showToast }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const STATUS_COLORS = { pending:"badge-orange", processing:"badge-blue", shipped:"badge-blue", delivered:"badge-green", cancelled:"badge-red" };

  const load = () => { setLoading(true); api.orders.allOrders({ limit: 100 }).then(d => { setOrders(d.orders); setLoading(false); }); };
  useEffect(load, []);

  const handleStatus = async (id, status) => {
    try { await api.orders.updateStatus(id, status); showToast("Order status updated."); load(); }
    catch (e) { showToast(e.message, "error"); }
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 26 }}>Orders</h2>
        <button className="btn-ghost" onClick={load} style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="refresh" size={14}/> Refresh</button>
      </div>
      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner"/></div> : (
        <div className="card" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "var(--beige)", textAlign: "left" }}>
              {["Order","Customer","Items","Total","Date","Status","Update"].map(h => <th key={h} style={{ padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>{o.id}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{o.customer?.name||"—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>{o.items.length} item{o.items.length!==1?"s":""}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "var(--terra)" }}>₹{o.total.toFixed(2)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>{o.createdAt?.split("T")[0]}</td>
                  <td style={{ padding: "12px 16px" }}><span className={`tag ${STATUS_COLORS[o.status]||"badge-orange"}`} style={{ textTransform: "capitalize" }}>{o.status}</span></td>
                  <td style={{ padding: "12px 16px" }}>
                    <select value={o.status} onChange={e => handleStatus(o.id, e.target.value)} style={{ padding: "6px 10px", border: "1.5px solid var(--border)", borderRadius: 4, fontSize: 13, background: "white", cursor: "pointer", outline: "none" }}>
                      {["pending","processing","shipped","delivered","cancelled"].map(s => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const AdminUsers = ({ showToast }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); api.users.list({ limit: 100 }).then(d => { setUsers(d.users); setLoading(false); }); };
  useEffect(load, []);

  const handleRole = async (id, role, name) => {
    try { await api.users.updateRole(id, role); showToast(`${name} is now a ${role}.`); load(); }
    catch (e) { showToast(e.message, "error"); }
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 26 }}>Users</h2>
        <button className="btn-ghost" onClick={load} style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="refresh" size={14}/> Refresh</button>
      </div>
      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner"/></div> : (
        <div className="card" style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "var(--beige)", textAlign: "left" }}>
              {["User","Email","Role","Orders","Spent","Joined","Actions"].map(h => <th key={h} style={{ padding: "12px 16px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: u.role==="admin"?"var(--terra)":"var(--sage)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>{u.name[0]}</div>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "var(--text-muted)" }}>{u.email}</td>
                  <td style={{ padding: "12px 16px" }}><span className={`tag ${u.role==="admin"?"badge-orange":"badge-blue"}`}>{u.role}</span></td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{u.order_count}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "var(--terra)", fontWeight: 500 }}>₹{Number(u.total_spent).toFixed(2)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-muted)" }}>{u.created_at?.split("T")[0]}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <select value={u.role} onChange={e => handleRole(u.id, e.target.value, u.name)} style={{ padding: "6px 10px", border: "1.5px solid var(--border)", borderRadius: 4, fontSize: 13, background: "white", cursor: "pointer", outline: "none" }}>
                      <option value="customer">Customer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const AboutPage = () => (
  <div style={{ maxWidth: 820, margin: "0 auto", padding: "60px 20px 80px" }}>
    <div style={{ textAlign: "center", marginBottom: 60 }}>
      <p style={{ fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--sage-dark)", fontWeight: 500, marginBottom: 12 }}>Our Story</p>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(36px,5vw,52px)", fontWeight: 300, fontStyle: "italic" }}>Made Slowly. Made Beautifully.</h1>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", marginBottom: 60 }}>
      <div style={{ background: "var(--beige)", borderRadius: 16, height: 320, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 100 }}>🌿</div>
      <div>
        <p style={{ fontSize: 16, lineHeight: 1.9, color: "var(--text-muted)", marginBottom: 20 }}>The Crafted Nest began in 2018 as a small collective of artisans who believed that the world needed more objects made with care, intention, and a deep respect for materials and time.</p>
        <p style={{ fontSize: 16, lineHeight: 1.9, color: "var(--text-muted)" }}>Every product is made by hand—thrown on wheels, knotted by fingers, dipped in wax, and stitched with patience. We partner with makers who share our values.</p>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
      {[["🌱","Sustainably Sourced","We work only with materials that are kind to the planet."],["🤝","Artisan First","Fair wages and long-term partnerships with every maker."],["📦","Zero Waste","All orders ship in recycled or biodegradable materials."]].map(([em,title,desc]) => (
        <div key={title} className="card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>{em}</div>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 18, marginBottom: 10 }}>{title}</h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>{desc}</p>
        </div>
      ))}
    </div>
  </div>
);

const Footer = () => {
  const { navigate } = useApp();
  return (
    <footer style={{ background: "var(--brown)", color: "rgba(255,255,255,0.8)", padding: "48px 20px 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><Icon name="leaf" size={20} color="var(--sage-light)"/><span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "white" }}>The Crafted Nest</span></div>
            <p style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.7, maxWidth: 280 }}>Handmade goods crafted with intention by artisans who believe in the beauty of slow making.</p>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14, color: "var(--sage-light)" }}>Shop</p>
            {["All Products","Ceramics","Textiles","Candles","Wellness"].map(l => <button key={l} onClick={() => navigate("home")} style={{ display: "block", background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 8, textAlign: "left", cursor: "pointer" }}>{l}</button>)}
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14, color: "var(--sage-light)" }}>Company</p>
            {[["About","about"],["Login","login"],["Register","register"]].map(([l,p]) => <button key={l} onClick={() => navigate(p)} style={{ display: "block", background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 8, textAlign: "left", cursor: "pointer" }}>{l}</button>)}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 12, opacity: 0.5 }}>
          <span>© {new Date().getFullYear()} The Crafted Nest. All rights reserved.</span>
          <span>Made with 🤍 for mindful living</span>
        </div>
      </div>
    </footer>
  );
};

const Router = () => {
  const { page, authLoading } = useApp();
  if (authLoading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}><div className="spinner"/></div>;
  const pages = { home: HomePage, product: ProductPage, login: LoginPage, register: RegisterPage, forgot: ForgotPage, checkout: CheckoutPage, orders: OrdersPage, admin: AdminPage, about: AboutPage };
  const Page = pages[page] || HomePage;
  return <Page/>;
};

export default function App() {
  return (
    <AppProvider>
      <GlobalStyles/>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Navbar/>
        <main style={{ flex: 1 }}><Router/></main>
        <Footer/>
        <CartSidebar/>
        <Toast/>
      </div>
    </AppProvider>
  );
}