import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// ========== شاشة الترحيب ==========
function SplashScreen() {
  return (
    <div style={splashStyles.container}>
      <div style={splashStyles.iconBox}><span style={splashStyles.iconText}>S</span></div>
      <h1 style={splashStyles.title}>Stockeeper</h1>
      <p style={splashStyles.subtitle}>Asset Manager</p>
      <div style={splashStyles.loader}><div style={splashStyles.loaderFill}></div></div>
    </div>
  );
}

// ========== الشاشة الرئيسية ==========
function Dashboard({ onNavigate, faultyCount, basicTotal, warehouseTotal, theatersCount }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (term) => {
    setSearchTerm(term);
    if (!term.trim()) { setSearchResults([]); setShowResults(false); return; }
    const lower = term.toLowerCase();
    const { data: basicItems } = await supabase.from('items').select('name, qty, categories!inner(type)').eq('categories.type', 'basic').ilike('name', `%${lower}%`);
    const { data: whItems } = await supabase.from('items').select('name, qty, categories!inner(type)').eq('categories.type', 'warehouse').ilike('name', `%${lower}%`);
    const { data: thItems } = await supabase.from('theater_items').select('name, qty, theater_categories!inner(theaters!inner(name))').ilike('name', `%${lower}%`);
    const results = [];
    const addResult = (name, source, qty, locationName) => {
      let existing = results.find(r => r.name.toLowerCase() === name.toLowerCase());
      if (!existing) { existing = { name, basicQty: 0, warehouseQty: 0, theaters: [] }; results.push(existing); }
      if (source === 'basic') existing.basicQty += qty;
      else if (source === 'warehouse') existing.warehouseQty += qty;
      else if (source === 'theater') {
        let t = existing.theaters.find(x => x.name === locationName);
        if (t) t.qty += qty;
        else existing.theaters.push({ name: locationName, qty });
      }
    };
    basicItems?.forEach(i => addResult(i.name, 'basic', i.qty));
    whItems?.forEach(i => addResult(i.name, 'warehouse', i.qty));
    thItems?.forEach(i => addResult(i.name, 'theater', i.qty, i.theater_categories?.theaters?.name));
    setSearchResults(results);
    setShowResults(true);
  };

  return (
    <div style={mainStyles.body}>
      <header style={mainStyles.header}>
        <h2 style={mainStyles.logo}>📦 Stockeeper</h2>
        <div style={mainStyles.headerActions}>
          <div style={{ position: 'relative' }}>
            <div style={mainStyles.searchBox}>
              <span style={mainStyles.searchIcon}>🔍</span>
              <input type="text" placeholder="Search an item..." style={mainStyles.searchInput} value={searchTerm} onChange={(e) => handleSearch(e.target.value)} onFocus={() => searchResults.length > 0 && setShowResults(true)} onBlur={() => setTimeout(() => setShowResults(false), 200)} />
            </div>
            {showResults && searchResults.length > 0 && (
              <div style={searchDropdownStyles.container}>
                {searchResults.map((result, idx) => (
                  <div key={idx} style={searchDropdownStyles.item}>
                    <div style={searchDropdownStyles.name}>{result.name}</div>
                    <div style={searchDropdownStyles.details}>
                      {result.basicQty > 0 && <span>🏢 Total: {result.basicQty}</span>}
                      {result.warehouseQty > 0 && <span> | 🏭 WH: {result.warehouseQty}</span>}
                      {result.theaters.map(t => (<span key={t.name}> | 🎭 {t.name}: {t.qty}</span>))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={mainStyles.bell}>🔔<span style={mainStyles.badge}>3</span></div>
        </div>
      </header>
      <div style={mainStyles.cardsGrid}>
        <div style={mainStyles.card} onClick={() => onNavigate('basicStore')}><div style={mainStyles.cardIcon}>🏢</div><h3 style={mainStyles.cardTitle}>Basic Store</h3><p style={mainStyles.cardNumber}>{basicTotal}</p><p style={mainStyles.cardSub}>Total Items</p></div>
        <div style={mainStyles.card} onClick={() => onNavigate('warehouse')}><div style={mainStyles.cardIcon}>🏭</div><h3 style={mainStyles.cardTitle}>Warehouse</h3><p style={mainStyles.cardNumber}>{warehouseTotal}</p><p style={mainStyles.cardSub}>Available Items</p></div>
        <div style={mainStyles.card} onClick={() => onNavigate('theaters')}><div style={mainStyles.cardIcon}>🎭</div><h3 style={mainStyles.cardTitle}>Theaters</h3><p style={mainStyles.cardNumber}>{theatersCount}</p><p style={mainStyles.cardSub}>Active Theaters</p></div>
        <div style={{...mainStyles.card, borderColor: faultyCount > 0 ? '#e74c3c' : '#27ae60'}} onClick={() => onNavigate('repair')}><div style={mainStyles.cardIcon}>🔧</div><h3 style={mainStyles.cardTitle}>Needs Repair</h3><p style={{...mainStyles.cardNumber, color: faultyCount > 0 ? '#e74c3c' : '#27ae60'}}>{faultyCount}</p><p style={mainStyles.cardSub}>Faulty Items</p></div>
      </div>
    </div>
  );
}

// ========== نافذة المخازن العامة ==========
function InventoryView({ title, icon, type, onBack }) {
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newItemName, setNewItemName] = useState({});
  const [newItemQty, setNewItemQty] = useState({});
  const [expandedCat, setExpandedCat] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editQty, setEditQty] = useState('');

  useEffect(() => { fetchData(); }, [type]);

  const fetchData = async () => {
    const { data: cats } = await supabase.from('categories').select('id, name, items(id, name, qty, status)').eq('type', type).order('id');
    setCategories(cats || []);
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const { data, error } = await supabase.from('categories').insert({ name, type }).select('id, name').single();
    if (!error && data) {
      setCategories([...categories, { id: data.id, name: data.name, items: [] }]);
      setNewCatName('');
    }
  };

  const deleteCategory = async (catId) => {
    await supabase.from('categories').delete().eq('id', catId);
    setCategories(categories.filter(c => c.id !== catId));
  };

  const addItem = async (catId) => {
    const name = newItemName[catId];
    const qty = parseInt(newItemQty[catId]);
    if (!name || !qty || qty < 1) return;
    const { data, error } = await supabase.from('items').insert({ category_id: catId, name, qty, status: 'good' }).select('id, name, qty, status').single();
    if (!error && data) {
      setCategories(categories.map(c => c.id === catId ? { ...c, items: [...c.items, data] } : c));
      setNewItemName({ ...newItemName, [catId]: '' });
      setNewItemQty({ ...newItemQty, [catId]: '' });
    }
  };

  const deleteItem = async (catId, itemId) => {
    await supabase.from('items').delete().eq('id', itemId);
    setCategories(categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c));
  };

  const toggleStatus = async (catId, itemId, currentStatus) => {
    const newStatus = currentStatus === 'good' ? 'faulty' : 'good';
    await supabase.from('items').update({ status: newStatus }).eq('id', itemId);
    setCategories(categories.map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, status: newStatus } : i) } : c));
  };

  const startEditItem = (catId, itemId, currentQty) => { setEditingItem({ catId, itemId }); setEditQty(currentQty.toString()); };
  const saveEditItem = async (catId, itemId) => {
    const newQty = parseInt(editQty);
    if (isNaN(newQty) || newQty < 0) return;
    await supabase.from('items').update({ qty: newQty }).eq('id', itemId);
    setCategories(categories.map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, qty: newQty } : i) } : c));
    setEditingItem(null); setEditQty('');
  };

  const handleExportPDF = () => {
    let htmlContent = '';
    categories.forEach(cat => {
      htmlContent += `<h2>${cat.name} (${cat.items.length} items)</h2><table><tr><th>Name</th><th>Qty</th><th>Status</th></tr>`;
      cat.items.forEach(item => { htmlContent += `<tr><td>${item.name}</td><td>${item.qty}</td><td class="${item.status === 'good' ? 'good' : 'faulty'}">${item.status === 'good' ? 'Good' : 'Faulty'}</td></tr>`; });
      htmlContent += '</table>';
    });
    exportToPDF(title, htmlContent);
  };

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.container}>
        <div style={modalStyles.header}>
          <button style={modalStyles.backBtn} onClick={onBack}>← Back</button>
          <h2 style={modalStyles.title}>{icon} {title}</h2>
          <button style={modalStyles.pdfBtn} onClick={handleExportPDF}>📄 PDF</button>
        </div>
        <div style={modalStyles.addRow}>
          <input style={modalStyles.input} placeholder="New category name..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
          <button style={modalStyles.addBtn} onClick={addCategory}>+ Add Category</button>
        </div>
        <div style={modalStyles.list}>
          {categories.map(cat => (
            <div key={cat.id} style={modalStyles.categoryCard}>
              <div style={modalStyles.categoryHeader} onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
                <span style={modalStyles.arrow}>{expandedCat === cat.id ? '▼' : '▶'}</span>
                <span style={modalStyles.catName}>{cat.name}</span>
                <span style={modalStyles.itemCount}>({cat.items.length} items)</span>
                <button style={modalStyles.deleteBtn} onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }}>🗑️</button>
              </div>
              {expandedCat === cat.id && (
                <div style={modalStyles.itemsContainer}>
                  {cat.items.map(item => (
                    <div key={item.id} style={modalStyles.itemRow}>
                      <span style={modalStyles.itemName}>{item.name}</span>
                      {editingItem && editingItem.catId === cat.id && editingItem.itemId === item.id ? (
                        <div style={{ display: 'flex', gap: 5, flex: 1 }}>
                          <input type="number" style={{ ...modalStyles.input, width: 60, padding: '4px 8px' }} value={editQty} onChange={(e) => setEditQty(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEditItem(cat.id, item.id); }} />
                          <button style={modalStyles.addBtn} onClick={() => saveEditItem(cat.id, item.id)}>✓</button>
                        </div>
                      ) : (<span style={modalStyles.itemQty}>Qty: {item.qty}</span>)}
                      {!editingItem && (<button style={{ ...modalStyles.statusBtn, background: '#3498db', marginRight: 5 }} onClick={() => startEditItem(cat.id, item.id, item.qty)}>✎</button>)}
                      <button style={{ ...modalStyles.statusBtn, background: item.status === 'good' ? '#27ae60' : '#e74c3c' }} onClick={() => toggleStatus(cat.id, item.id, item.status)}>{item.status === 'good' ? 'Good' : 'Faulty'}</button>
                      <button style={modalStyles.deleteBtn} onClick={() => deleteItem(cat.id, item.id)}>🗑️</button>
                    </div>
                  ))}
                  <div style={modalStyles.addItemRow}>
                    <input style={{...modalStyles.input, flex: 2}} placeholder="Item name..." value={newItemName[cat.id] || ''} onChange={(e) => setNewItemName({ ...newItemName, [cat.id]: e.target.value })} />
                    <input style={{...modalStyles.input, flex: 1}} type="number" placeholder="Qty..." value={newItemQty[cat.id] || ''} onChange={(e) => setNewItemQty({ ...newItemQty, [cat.id]: e.target.value })} />
                    <button style={modalStyles.addBtn} onClick={() => addItem(cat.id)}>+ Add</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== نافذة المسارح ==========
function TheatersView({ onBack }) {
  const [theaters, setTheaters] = useState([]);
  const [selectedTheaterId, setSelectedTheaterId] = useState(null);
  const [newTheaterName, setNewTheaterName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemSource, setNewItemSource] = useState('warehouse');
  const [expandedCat, setExpandedCat] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editDiff, setEditDiff] = useState(0);
  const [editMode, setEditMode] = useState(null);
  const [editTarget, setEditTarget] = useState('warehouse');

  const selectedTheater = theaters.find(t => t.id === selectedTheaterId);

  useEffect(() => { fetchTheaters(); }, []);

  const fetchTheaters = async () => {
    const { data } = await supabase.from('theaters').select('id, name, theater_categories(id, name, theater_items(id, name, qty, status))').order('id');
    if (data) setTheaters(data.map(t => ({ ...t, categories: t.theater_categories || [] })));
  };

  const sourceOptions = [
    { value: 'warehouse', label: '🏭 Warehouse' },
    ...theaters.filter(t => t.id !== selectedTheaterId).map(t => ({ value: `theater_${t.id}`, label: `🎭 ${t.name}` })),
  ];

  const addTheater = async () => {
    const name = newTheaterName.trim();
    if (!name) return;
    const { data, error } = await supabase.from('theaters').insert({ name }).select('id, name').single();
    if (!error && data) {
      setTheaters([...theaters, { id: data.id, name: data.name, categories: [] }]);
      setNewTheaterName('');
    }
  };

  const deleteTheater = async (id) => {
    await supabase.from('theaters').delete().eq('id', id);
    setTheaters(theaters.filter(t => t.id !== id));
    if (selectedTheaterId === id) setSelectedTheaterId(null);
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const { data, error } = await supabase.from('theater_categories').insert({ theater_id: selectedTheaterId, name }).select('id, name').single();
    if (!error && data) {
      setTheaters(theaters.map(t => t.id === selectedTheaterId ? { ...t, categories: [...t.categories, { id: data.id, name: data.name, items: [] }] } : t));
      setNewCatName('');
    }
  };

  const deleteCategory = async (catId) => {
    await supabase.from('theater_categories').delete().eq('id', catId);
    setTheaters(theaters.map(t => t.id === selectedTheaterId ? { ...t, categories: t.categories.filter(c => c.id !== catId) } : t));
  };

  const addItemToTheater = async () => {
    const name = newItemName.trim();
    const qty = parseInt(newItemQty);
    if (!name || !qty || qty < 1) return;
    const catId = expandedCat;

    if (newItemSource === 'warehouse') {
      const { data: whItems } = await supabase.from('items').select('id, qty, categories!inner(type)').eq('categories.type', 'warehouse').ilike('name', name);
      if (whItems && whItems.length > 0) {
        const item = whItems[0];
        await supabase.from('items').update({ qty: item.qty - qty }).eq('id', item.id);
      }
    } else if (newItemSource.startsWith('theater_')) {
      const sourceId = parseInt(newItemSource.replace('theater_', ''));
      const { data: thItems } = await supabase.from('theater_items').select('id, qty').ilike('name', name).eq('theater_category_id', sourceId);
      if (thItems && thItems.length > 0) {
        await supabase.from('theater_items').update({ qty: thItems[0].qty - qty }).eq('id', thItems[0].id);
      }
    }

    const { data, error } = await supabase.from('theater_items').insert({ theater_category_id: catId, name, qty, status: 'good' }).select('id, name, qty, status').single();
    if (!error && data) {
      setTheaters(theaters.map(t => t.id === selectedTheaterId ? { ...t, categories: t.categories.map(c => c.id === catId ? { ...c, items: [...c.items, data] } : c) } : t));
      setNewItemName(''); setNewItemQty('');
    }
  };

  const deleteItem = async (catId, itemId) => {
    const theater = theaters.find(t => t.id === selectedTheaterId);
    const cat = theater?.categories.find(c => c.id === catId);
    const item = cat?.items.find(i => i.id === itemId);
    if (item) {
      const { data: whItems } = await supabase.from('items').select('id, qty').ilike('name', item.name).eq('categories.type', 'warehouse');
      if (whItems && whItems.length > 0) {
        await supabase.from('items').update({ qty: whItems[0].qty + item.qty }).eq('id', whItems[0].id);
      } else {
        const { data: whCat } = await supabase.from('categories').select('id').eq('type', 'warehouse').limit(1).single();
        if (whCat) await supabase.from('items').insert({ category_id: whCat.id, name: item.name, qty: item.qty, status: item.status });
      }
    }
    await supabase.from('theater_items').delete().eq('id', itemId);
    setTheaters(theaters.map(t => t.id === selectedTheaterId ? { ...t, categories: t.categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) } : t));
  };

  const toggleStatus = async (catId, itemId, currentStatus) => {
    const newStatus = currentStatus === 'good' ? 'faulty' : 'good';
    await supabase.from('theater_items').update({ status: newStatus }).eq('id', itemId);
    setTheaters(theaters.map(t => t.id === selectedTheaterId ? { ...t, categories: t.categories.map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, status: newStatus } : i) } : c) } : t));
  };

  const startEditItem = (catId, itemId, currentQty) => { setEditingItem({ catId, itemId }); setEditQty(currentQty.toString()); setEditDiff(0); setEditMode(null); setEditTarget('warehouse'); };
  const handleQtyChange = (val) => {
    setEditQty(val);
    if (!editingItem) return;
    const theater = theaters.find(t => t.id === selectedTheaterId);
    const cat = theater?.categories.find(c => c.id === editingItem.catId);
    const item = cat?.items.find(i => i.id === editingItem.itemId);
    if (!item) return;
    const newQty = parseInt(val) || 0;
    const diff = newQty - item.qty;
    setEditDiff(diff);
    setEditMode(diff > 0 ? 'increase' : diff < 0 ? 'decrease' : null);
  };

  const saveEditItem = async (catId, itemId) => {
    const newQty = parseInt(editQty);
    if (isNaN(newQty) || newQty < 0) return;
    const theater = theaters.find(t => t.id === selectedTheaterId);
    const cat = theater?.categories.find(c => c.id === catId);
    const item = cat?.items.find(i => i.id === itemId);
    if (!item) return;
    const diff = newQty - item.qty;

    if (diff > 0) {
      if (editTarget === 'warehouse') {
        const { data: whItems } = await supabase.from('items').select('id, qty').eq('categories.type', 'warehouse').ilike('name', item.name);
        if (whItems && whItems.length > 0) await supabase.from('items').update({ qty: whItems[0].qty - diff }).eq('id', whItems[0].id);
      }
    } else if (diff < 0) {
      if (editTarget === 'warehouse') {
        const { data: whItems } = await supabase.from('items').select('id, qty').eq('categories.type', 'warehouse').ilike('name', item.name);
        if (whItems && whItems.length > 0) await supabase.from('items').update({ qty: whItems[0].qty + Math.abs(diff) }).eq('id', whItems[0].id);
      }
    }

    await supabase.from('theater_items').update({ qty: newQty }).eq('id', itemId);
    setTheaters(theaters.map(t => t.id === selectedTheaterId ? { ...t, categories: t.categories.map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, qty: newQty } : i) } : c) } : t));
    setEditingItem(null); setEditQty(''); setEditDiff(0); setEditMode(null);
  };

  const handleExportPDF = (theaterName) => {
    const theater = theaters.find(t => t.name === theaterName);
    if (!theater) return;
    let htmlContent = '';
    theater.categories.forEach(cat => {
      htmlContent += `<h2>${cat.name} (${cat.items.length} items)</h2><table><tr><th>Name</th><th>Qty</th><th>Status</th></tr>`;
      cat.items.forEach(item => { htmlContent += `<tr><td>${item.name}</td><td>${item.qty}</td><td class="${item.status === 'good' ? 'good' : 'faulty'}">${item.status === 'good' ? 'Good' : 'Faulty'}</td></tr>`; });
      htmlContent += '</table>';
    });
    exportToPDF(theaterName, htmlContent);
  };

  if (!selectedTheater) {
    return (
      <div style={modalStyles.overlay}>
        <div style={modalStyles.container}>
          <div style={modalStyles.header}><button style={modalStyles.backBtn} onClick={onBack}>← Back</button><h2 style={modalStyles.title}>🎭 Theaters</h2><div style={{ width: 60 }}></div></div>
          <div style={modalStyles.addRow}><input style={modalStyles.input} placeholder="New theater name..." value={newTheaterName} onChange={(e) => setNewTheaterName(e.target.value)} /><button style={modalStyles.addBtn} onClick={addTheater}>+ Add Theater</button></div>
          <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', marginTop: 20 }}>
            {theaters.map(theater => (
              <div key={theater.id} style={{ ...mainStyles.card, minWidth: 200, cursor: 'pointer' }} onClick={() => setSelectedTheaterId(theater.id)}>
                <div style={mainStyles.cardIcon}>🎭</div><h3 style={mainStyles.cardTitle}>{theater.name}</h3><p style={mainStyles.cardSub}>{theater.categories.length} categories</p>
                <button style={{...modalStyles.deleteBtn, fontSize: 12, marginTop: 10}} onClick={(e) => { e.stopPropagation(); deleteTheater(theater.id); }}>🗑️ Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.container}>
        <div style={modalStyles.header}>
          <button style={modalStyles.backBtn} onClick={() => setSelectedTheaterId(null)}>← Theaters</button>
          <h2 style={modalStyles.title}>🎭 {selectedTheater.name}</h2>
          <button style={modalStyles.pdfBtn} onClick={() => handleExportPDF(selectedTheater.name)}>📄 PDF</button>
        </div>
        <div style={modalStyles.addRow}><input style={modalStyles.input} placeholder="New category..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} /><button style={modalStyles.addBtn} onClick={addCategory}>+ Add Category</button></div>
        <div style={modalStyles.list}>
          {selectedTheater.categories.map(cat => (
            <div key={cat.id} style={modalStyles.categoryCard}>
              <div style={modalStyles.categoryHeader} onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
                <span style={modalStyles.arrow}>{expandedCat === cat.id ? '▼' : '▶'}</span><span style={modalStyles.catName}>{cat.name}</span><span style={modalStyles.itemCount}>({cat.items.length} items)</span>
                <button style={modalStyles.deleteBtn} onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }}>🗑️</button>
              </div>
              {expandedCat === cat.id && (
                <div style={modalStyles.itemsContainer}>
                  {cat.items.map(item => (
                    <div key={item.id} style={modalStyles.itemRow}>
                      <span style={modalStyles.itemName}>{item.name}</span>
                      {editingItem && editingItem.catId === cat.id && editingItem.itemId === item.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}><input type="number" style={{ ...modalStyles.input, width: 60, padding: '4px 8px' }} value={editQty} onChange={(e) => handleQtyChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEditItem(cat.id, item.id); }} /><button style={modalStyles.addBtn} onClick={() => saveEditItem(cat.id, item.id)}>✓</button></div>
                          {editMode && (<div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}><span style={{ fontSize: 11, color: '#555' }}>{editMode === 'increase' ? `⚠️ +${editDiff} from:` : `↩️ ${Math.abs(editDiff)} to:`}</span><select style={{ ...modalStyles.input, width: 'auto', padding: '4px 8px', fontSize: 11 }} value={editTarget} onChange={(e) => setEditTarget(e.target.value)}>{sourceOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></div>)}
                        </div>
                      ) : (<span style={modalStyles.itemQty}>Qty: {item.qty}</span>)}
                      {!editingItem && (<button style={{ ...modalStyles.statusBtn, background: '#3498db', marginRight: 5 }} onClick={() => startEditItem(cat.id, item.id, item.qty)}>✎</button>)}
                      <button style={{ ...modalStyles.statusBtn, background: item.status === 'good' ? '#27ae60' : '#e74c3c' }} onClick={() => toggleStatus(cat.id, item.id, item.status)}>{item.status === 'good' ? 'Good' : 'Faulty'}</button>
                      <button style={modalStyles.deleteBtn} onClick={() => deleteItem(cat.id, item.id)}>🗑️</button>
                    </div>
                  ))}
                  <div style={{...modalStyles.addItemRow, flexDirection: 'column', gap: 8}}>
                    <div style={{ display: 'flex', gap: 8 }}><input style={{...modalStyles.input, flex: 2}} placeholder="Item name..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} /><input style={{...modalStyles.input, flex: 1}} type="number" placeholder="Qty..." value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 13, color: '#555' }}>From:</span><select style={{...modalStyles.input, flex: 1}} value={newItemSource} onChange={(e) => setNewItemSource(e.target.value)}>{sourceOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select><button style={modalStyles.addBtn} onClick={addItemToTheater}>+ Add</button></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== نافذة Needs Repair ==========
function RepairView({ onBack }) {
  const [faultyItems, setFaultyItems] = useState([]);

  useEffect(() => { fetchFaulty(); }, []);

  const fetchFaulty = async () => {
    const { data: basic } = await supabase.from('items').select('id, name, qty').eq('status', 'faulty');
    const { data: warehouse } = await supabase.from('items').select('id, name, qty').eq('status', 'faulty');
    const { data: theater } = await supabase.from('theater_items').select('id, name, qty, theater_categories!inner(theaters!inner(name))').eq('status', 'faulty');

    const all = [];
    basic?.forEach(i => all.push({ ...i, location: 'Basic Store', source: 'basic' }));
    warehouse?.forEach(i => all.push({ ...i, location: 'Warehouse', source: 'warehouse' }));
    theater?.forEach(i => all.push({ ...i, location: i.theater_categories?.theaters?.name || 'Unknown Theater', source: 'theater' }));
    setFaultyItems(all);
  };

  const markAsGood = async (item) => {
    if (item.source === 'theater') {
      await supabase.from('theater_items').update({ status: 'good' }).eq('id', item.id);
    } else {
      await supabase.from('items').update({ status: 'good' }).eq('id', item.id);
    }
    fetchFaulty();
  };

  const handleExportPDF = () => {
    let htmlContent = `<table><tr><th>Name</th><th>Qty</th><th>Location</th><th>Status</th></tr>`;
    faultyItems.forEach(item => { htmlContent += `<tr><td>${item.name}</td><td>${item.qty}</td><td>${item.location}</td><td class="faulty">Faulty</td></tr>`; });
    htmlContent += '</table>';
    exportToPDF('Needs Repair', htmlContent);
  };

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.container}>
        <div style={modalStyles.header}>
          <button style={modalStyles.backBtn} onClick={onBack}>← Back</button>
          <h2 style={modalStyles.title}>🔧 Needs Repair</h2>
          <button style={modalStyles.pdfBtn} onClick={handleExportPDF}>📄 PDF</button>
        </div>
        {faultyItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#27ae60' }}><div style={{ fontSize: 60 }}>✅</div><h3>All items are in good condition!</h3></div>
        ) : (
          <div style={modalStyles.list}>
            {faultyItems.map(item => (
              <div key={`${item.source}-${item.id}`} style={modalStyles.categoryCard}>
                <div style={modalStyles.itemRow}>
                  <span style={{...modalStyles.itemName, flex: 2}}>{item.name}</span>
                  <span style={{...modalStyles.itemQty, flex: 1}}>Qty: {item.qty}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#888' }}>📍 {item.location}</span>
                  <button style={{ ...modalStyles.addBtn, background: '#27ae60', padding: '6px 14px', fontSize: 12 }} onClick={() => markAsGood(item)}>✔ Mark Good</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== دالة تصدير PDF ==========
const exportToPDF = (title, content) => {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  const html = `<html><head><title>${title}</title><style>body{font-family:Arial;padding:30px;color:#1a1a2e}h1{color:#d4a017;border-bottom:3px solid #d4a017;padding-bottom:10px}h2{color:#2c3e50;margin-top:25px}table{width:100%;border-collapse:collapse;margin:15px 0}th{background:#d4a017;color:#fff;padding:10px;text-align:left}td{padding:8px 10px;border-bottom:1px solid #eee}.faulty{color:#e74c3c;font-weight:bold}.good{color:#27ae60}.footer{margin-top:30px;font-size:11px;color:#888;text-align:center}</style></head><body><h1>📦 Stockeeper - ${title}</h1><p>Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}</p>${content}<div class="footer">Generated by Stockeeper</div></body></html>`;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

// ========== التطبيق الرئيسي ==========
export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState(null);
  const [faultyCount, setFaultyCount] = useState(0);
  const [basicTotal, setBasicTotal] = useState(0);
  const [warehouseTotal, setWarehouseTotal] = useState(0);
  const [theatersCount, setTheatersCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    fetchCounts();
    return () => clearTimeout(timer);
  }, []);

  const fetchCounts = async () => {
    const { data: basicItems } = await supabase.from('items').select('qty, categories!inner(type)').eq('categories.type', 'basic');
    const totalBasic = basicItems?.reduce((sum, i) => sum + i.qty, 0) || 0;

    const { data: whItems } = await supabase.from('items').select('qty, categories!inner(type)').eq('categories.type', 'warehouse');
    const totalWh = whItems?.reduce((sum, i) => sum + i.qty, 0) || 0;

    const { count: thCount } = await supabase.from('theaters').select('*', { count: 'exact', head: true });

    const { data: faultyBasic } = await supabase.from('items').select('id').eq('status', 'faulty').eq('categories.type', 'basic');
    const { data: faultyWh } = await supabase.from('items').select('id').eq('status', 'faulty').eq('categories.type', 'warehouse');
    const { data: faultyTh } = await supabase.from('theater_items').select('id').eq('status', 'faulty');

    setBasicTotal(totalBasic);
    setWarehouseTotal(totalWh);
    setTheatersCount(thCount || 0);
    setFaultyCount((faultyBasic?.length || 0) + (faultyWh?.length || 0) + (faultyTh?.length || 0));
  };

  const handleBack = () => {
    setCurrentView(null);
    fetchCounts();
  };

  if (loading) return <SplashScreen />;
  if (currentView === 'basicStore') return <InventoryView title="Basic Store" icon="🏢" type="basic" onBack={handleBack} />;
  if (currentView === 'warehouse') return <InventoryView title="Warehouse" icon="🏭" type="warehouse" onBack={handleBack} />;
  if (currentView === 'theaters') return <TheatersView onBack={handleBack} />;
  if (currentView === 'repair') return <RepairView onBack={handleBack} />;
  return <Dashboard onNavigate={setCurrentView} faultyCount={faultyCount} basicTotal={basicTotal} warehouseTotal={warehouseTotal} theatersCount={theatersCount} />;
}

// ========== Styles ==========
const splashStyles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8f9fa', fontFamily: 'Tahoma, sans-serif' },
  iconBox: { width: 100, height: 100, borderRadius: 25, background: 'linear-gradient(135deg, #f0c040, #d4a017)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 30, boxShadow: '0 0 30px rgba(212, 160, 23, 0.4)' },
  iconText: { fontSize: 55, fontWeight: 'bold', color: '#fff' },
  title: { fontSize: 50, color: '#1a1a2e', margin: 0, letterSpacing: 5 },
  subtitle: { fontSize: 18, color: '#d4a017', letterSpacing: 8, marginTop: 10 },
  loader: { width: 200, height: 4, background: '#e0e0e0', borderRadius: 10, marginTop: 40, overflow: 'hidden' },
  loaderFill: { height: '100%', width: '100%', background: 'linear-gradient(90deg, #d4a017, #f0c040)', animation: 'load 3s ease-in-out' },
};
const mainStyles = {
  body: { fontFamily: 'Tahoma, sans-serif', background: '#f4f6f9', minHeight: '100vh', padding: '0 20px 40px', color: '#2c3e50' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: '1px solid #e0e0e0', marginBottom: 30, flexWrap: 'wrap', gap: 15 },
  logo: { margin: 0, fontSize: 28, color: '#1a1a2e' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 15 },
  searchBox: { display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 30, padding: '8px 16px', border: '1px solid #ddd' },
  searchIcon: { fontSize: 16, marginRight: 5 },
  searchInput: { border: 'none', outline: 'none', fontSize: 14, width: 180, background: 'transparent', fontFamily: 'Tahoma' },
  bell: { position: 'relative', fontSize: 22, cursor: 'pointer', background: '#fff', padding: '10px 12px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  badge: { position: 'absolute', top: 4, right: 6, background: '#e74c3c', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginTop: 10 },
  card: { background: '#fff', borderRadius: 20, padding: '30px 20px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '2px solid #d4a017', transition: 'transform 0.2s', cursor: 'pointer' },
  cardIcon: { fontSize: 40, marginBottom: 10 },
  cardTitle: { fontSize: 18, margin: '10px 0 5px', color: '#555' },
  cardNumber: { fontSize: 36, fontWeight: 'bold', color: '#1a1a2e', margin: '5px 0' },
  cardSub: { fontSize: 13, color: '#888', margin: 0 },
};
const searchDropdownStyles = {
  container: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', borderRadius: 16, marginTop: 5, boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' },
  item: { padding: '12px 18px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' },
  name: { fontWeight: 'bold', fontSize: 15, color: '#1a1a2e', marginBottom: 4 },
  details: { fontSize: 12, color: '#666', display: 'flex', gap: 10, flexWrap: 'wrap' },
};
const modalStyles = {
  overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#f4f6f9', zIndex: 100, overflowY: 'auto', fontFamily: 'Tahoma, sans-serif' },
  container: { maxWidth: 800, margin: '0 auto', padding: '20px 20px 60px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  backBtn: { background: '#fff', border: '2px solid #d4a017', color: '#d4a017', padding: '8px 20px', borderRadius: 30, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
  pdfBtn: { background: '#fff', border: '2px solid #e74c3c', color: '#e74c3c', padding: '8px 16px', borderRadius: 30, cursor: 'pointer', fontWeight: 'bold', fontSize: 13 },
  title: { margin: 0, fontSize: 26, color: '#1a1a2e' },
  addRow: { display: 'flex', gap: 10, marginBottom: 20 },
  input: { flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, outline: 'none', fontFamily: 'Tahoma' },
  addBtn: { background: 'linear-gradient(135deg, #f0c040, #d4a017)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  categoryCard: { background: '#fff', borderRadius: 16, padding: '15px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
  categoryHeader: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  arrow: { fontSize: 12, color: '#888' },
  catName: { fontWeight: 'bold', fontSize: 18, flex: 1, color: '#1a1a2e' },
  itemCount: { fontSize: 13, color: '#888' },
  deleteBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 },
  itemsContainer: { marginTop: 15, borderTop: '1px solid #eee', paddingTop: 15 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f9f9f9' },
  itemName: { flex: 2, fontWeight: '500' },
  itemQty: { flex: 1, color: '#555' },
  statusBtn: { border: 'none', color: '#fff', padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' },
  addItemRow: { display: 'flex', gap: 8, marginTop: 10 },
};

const sheet = document.createElement('style');
sheet.innerText = `@keyframes load { 0% { width: 0%; } 100% { width: 100%; } }`;
document.head.appendChild(sheet);