import { useState, useMemo, useEffect } from "react";
import { 
  Heart, ShoppingBasket, Search, Trash2, ArrowRight, Download, Upload, 
  Bell, Filter, SlidersHorizontal, Package, Check, ChevronRight, X, AlertCircle, FileText, Share2
} from "lucide-react";
import { type Product } from "../data/catalog";
import { money } from "../lib/pricing";
import { PriceChangeBadge } from "../components/catalog/PriceChangeBadge";


interface FavoritesPageProps {
  products: Product[];
  favorites: string[];
  toggleFavorite: (id: string) => void;
  addBasket: (product: Product) => void;
  setToast: (msg: string) => void;
  user: any;
}

export default function FavoritesPage({ 
  products, 
  favorites, 
  toggleFavorite, 
  addBasket,
  setToast,
  user
}: FavoritesPageProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "brand" | "price" | "newest">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "brand">("grid");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("precocerto:price_alerts");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });


  const favoriteProducts = useMemo(() => {
    return products.filter(p => favorites.includes(String(p.id)));
  }, [products, favorites]);

  const filteredProducts = useMemo(() => {
    let result = favoriteProducts.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "brand") return a.brand.localeCompare(b.brand);
      if (sortBy === "price") return a.minPrice - b.minPrice;
      if (sortBy === "newest") {
        const indexA = favorites.indexOf(String(a.id));
        const indexB = favorites.indexOf(String(b.id));
        return indexB - indexA; // Ordem inversa de inserção (mais novo primeiro)
      }
      return 0;
    });


    return result;
  }, [favoriteProducts, search, sortBy]);

  const productsByBrand = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    filteredProducts.forEach(p => {
      if (!grouped[p.brand]) grouped[p.brand] = [];
      grouped[p.brand].push(p);
    });
    return grouped;
  }, [filteredProducts]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const removeSelected = () => {
    selectedIds.forEach(id => toggleFavorite(id));
    setSelectedIds([]);
    setToast(`${selectedIds.length} itens removidos dos favoritos.`);
  };

  const addSelectedToBasket = () => {
    selectedIds.forEach(id => {
      const p = products.find(prod => String(prod.id) === id);
      if (p) addBasket(p);
    });
    setSelectedIds([]);
    setToast(`${selectedIds.length} itens adicionados à cesta.`);
  };

  const togglePriceAlert = (id: string) => {
    const next = { ...priceAlerts, [id]: !priceAlerts[id] };
    setPriceAlerts(next);
    localStorage.setItem("precocerto:price_alerts", JSON.stringify(next));
    setToast(next[id] ? "Alerta de preço ativado!" : "Alerta de preço desativado.");
  };

  const exportFavorites = () => {
    const csvContent = [
      ["ID", "Nome", "Marca", "Preço Mínimo", "Estabelecimento"],
      ...favoriteProducts.map(p => [p.id, p.name, p.brand, p.minPrice, p.establishment])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `favoritos-precocerto-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast("Backup dos favoritos exportado com sucesso.");
  };

  const shareWhatsApp = () => {
    const text = `Confira minha lista de favoritos no PreçoCerto Feijó:\n\n${favoriteProducts.map(p => `- ${p.name}: ${money(p.minPrice)}`).join('\n')}\n\nEconomize você também em: www.precocerto.live`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };


  const exportFavoritesPDF = async () => {
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF();
      
      // Header do PDF
      doc.setFillColor(5, 38, 74); // Navy
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("PreçoCerto Feijó", 15, 20);
      doc.setFontSize(10);
      doc.text(`Minha Lista de Favoritos - ${new Date().toLocaleDateString('pt-BR')}`, 15, 30);
      
      // Tabela de produtos
      const tableData = favoriteProducts.map(p => [
        p.name,
        p.brand,
        p.establishment,
        money(p.minPrice)
      ]);

      autoTable(doc, {
        startY: 50,
        head: [["Produto", "Marca", "Loja", "Preço Mínimo"]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [49, 181, 34], textColor: [255, 255, 255] }, // Green
        styles: { fontSize: 9 },
        columnStyles: {
          3: { halign: 'right', fontStyle: 'bold' }
        }
      });

      // Rodapé
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          "Economize em Feijó com PreçoCerto - www.precocerto.live", 
          105, 
          285, 
          { align: 'center' }
        );
      }

      doc.save(`favoritos-precocerto-${new Date().toISOString().split('T')[0]}.pdf`);
      setToast("Lista em PDF gerada com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setToast("Erro ao gerar PDF de favoritos.");
    }
  };


  const importFavorites = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").slice(1);
        const ids = lines.map(line => line.split(",")[0]).filter(id => id && products.some(p => String(p.id) === id));
        
        const newFavs = Array.from(new Set([...favorites, ...ids]));
        localStorage.setItem("precocerto:favorites", JSON.stringify(newFavs));
        setToast(`${ids.length} favoritos importados com sucesso.`);
        window.location.reload();
      } catch (err) {
        setToast("Erro ao importar arquivo CSV.");
      }
    };
    reader.readAsText(file);
  };

  if (favorites.length === 0) {
    return (
      <div className="shell page-shell">
        <div className="favorites-page" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
          <div className="empty-state" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div style={{ background: 'var(--blue-soft)', width: '100px', height: '100px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', border: '2px solid var(--blue)' }}>
              <Heart size={48} color="var(--blue)" fill="var(--blue-glass)" />
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem', color: 'var(--text-main)' }}>Sua lista está vazia</h2>
            <p style={{ color: 'var(--muted)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
              Favorite os produtos que você mais compra para comparar preços rapidamente e economizar em Feijó.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <a href="/buscar" className="button button--primary" style={{ paddingInline: '2rem' }}>Explorar Produtos</a>
              <a href="/" className="button button--outline">Voltar ao Início</a>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="favorites-page" style={{ padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.25rem' }}>Meus Favoritos</h1>
            <p style={{ color: 'var(--muted)' }}>{favoriteProducts.length} itens salvos na sua lista pessoal</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="button button--primary" onClick={shareWhatsApp} title="Compartilhar no WhatsApp" style={{ background: 'var(--pc-color-primary)', borderColor: 'var(--pc-color-primary)', color: 'white' }}>
              <Share2 size={18} /> <span className="hide-mobile">WhatsApp</span>
            </button>
            <button className="button button--outline" onClick={exportFavoritesPDF} title="Exportar para PDF">
              <FileText size={18} /> <span className="hide-mobile">PDF</span>
            </button>
            <button className="button button--outline" onClick={exportFavorites} title="CSV">
              <Download size={18} />
            </button>
            <label className="button button--outline" style={{ cursor: 'pointer' }} title="Restaurar backup">
              <Upload size={18} />
              <input type="file" accept=".csv" onChange={importFavorites} style={{ display: 'none' }} />
            </label>
          </div>


        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} size={18} />
            <input 
              type="text" 
              placeholder="Buscar nos favoritos..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: '40px', background: 'var(--surface-2)', border: 'none', borderRadius: '12px', height: '44px' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as any)}
                className="button button--outline"
                style={{ appearance: 'none', paddingRight: '2.5rem', height: '44px', fontWeight: 600 }}
              >
                <option value="name">Nome (A-Z)</option>
                <option value="brand">Marca</option>
                <option value="price">Menor Preço</option>
                <option value="newest">Mais Recentes</option>
              </select>
              <Filter size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)' }} />
            </div>


            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: '12px', padding: '4px' }}>
              <button 
                onClick={() => setViewMode("grid")}
                style={{ padding: '8px', borderRadius: '8px', background: viewMode === "grid" ? 'var(--surface)' : 'transparent', border: 'none', color: viewMode === "grid" ? 'var(--text-main)' : 'var(--muted)' }}
              >
                <SlidersHorizontal size={18} />
              </button>
              <button 
                onClick={() => setViewMode("brand")}
                style={{ padding: '8px', borderRadius: '8px', background: viewMode === "brand" ? 'var(--surface)' : 'transparent', border: 'none', color: viewMode === "brand" ? 'var(--text-main)' : 'var(--muted)' }}
              >
                <Package size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {selectedIds.length > 0 && (
        <div style={{ 
          position: 'sticky', 
          top: '80px', 
          zIndex: 10, 
          background: 'var(--blue)', 
          color: 'white', 
          padding: '1rem', 
          borderRadius: '12px', 
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setSelectedIds([])} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
            <strong style={{ fontSize: '1rem' }}>{selectedIds.length} selecionados</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="button" style={{ background: 'white', color: 'var(--blue)', border: 'none' }} onClick={addSelectedToBasket}>
              Adicionar à Cesta
            </button>
            <button className="button" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }} onClick={removeSelected}>
              Remover
            </button>
          </div>
        </div>
      )}

      {viewMode === "grid" ? (
        <div className="favorites-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {filteredProducts.map(product => (
            <FavoriteCard 
              key={product.id}
              product={product}
              isSelected={selectedIds.includes(String(product.id))}
              onSelect={() => toggleSelection(String(product.id))}
              onToggleFavorite={() => toggleFavorite(String(product.id))}
              onAddBasket={() => addBasket(product)}
              hasAlert={!!priceAlerts[product.id]}
              onToggleAlert={() => togglePriceAlert(String(product.id))}
            />
          ))}
        </div>
      ) : (
        <div className="favorites-brand-groups">
          {Object.entries(productsByBrand).map(([brand, brandProducts]) => (
            <section key={brand} style={{ marginBottom: '3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{brand}</h2>
                <span style={{ height: '1px', flex: 1, background: 'var(--border-soft)' }}></span>
                <span style={{ fontSize: '0.85rem', color: 'var(--muted)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: '6px' }}>{brandProducts.length} itens</span>
              </div>
              <div className="favorites-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {brandProducts.map(product => (
                  <FavoriteCard 
                    key={product.id}
                    product={product}
                    isSelected={selectedIds.includes(String(product.id))}
                    onSelect={() => toggleSelection(String(product.id))}
                    onToggleFavorite={() => toggleFavorite(String(product.id))}
                    onAddBasket={() => addBasket(product)}
                    hasAlert={!!priceAlerts[product.id]}
                    onToggleAlert={() => togglePriceAlert(String(product.id))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {filteredProducts.length === 0 && search && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--muted)' }}>
          <AlertCircle size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>Nenhum favorito encontrado para "{search}"</p>
        </div>
      )}
    </div>
  );
}

function FavoriteCard({ 
  product, 
  isSelected, 
  onSelect, 
  onToggleFavorite, 
  onAddBasket,
  hasAlert,
  onToggleAlert
}: { 
  product: Product; 
  isSelected: boolean; 
  onSelect: () => void; 
  onToggleFavorite: () => void;
  onAddBasket: () => void;
  hasAlert: boolean;
  onToggleAlert: () => void;
}) {
  const openDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('pc:open-product-details', { detail: product }));
  };

  return (
    <div className={`favorite-card ${isSelected ? 'selected' : ''}`} style={{ 
      position: 'relative', 
      background: 'var(--surface)', 
      borderRadius: '24px', 
      padding: '1.25rem',
      border: isSelected ? '2px solid var(--blue)' : '1px solid var(--border)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      boxShadow: isSelected ? '0 10px 25px var(--blue-glass)' : 'var(--shadow-sm)'
    }} onClick={onSelect}>


      <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
        <div style={{ 
          width: '24px', 
          height: '24px', 
          borderRadius: '6px', 
          border: '2px solid var(--border)', 
          background: isSelected ? 'var(--blue)' : 'white',
          borderColor: isSelected ? 'var(--blue)' : 'var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}>
          {isSelected && <Check size={16} />}
        </div>
      </div>

      <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2, display: 'flex', gap: '0.5rem' }}>
        <button 
          className={`icon-button ${hasAlert ? 'active' : ''}`} 
          onClick={(e) => { e.stopPropagation(); onToggleAlert(); }}
          style={{ 
            background: hasAlert ? 'var(--gold-soft)' : 'var(--surface-2)', 
            color: hasAlert ? 'var(--gold)' : 'var(--muted)',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title={hasAlert ? "Alerta ativo" : "Criar alerta de preço"}
        >
          <Bell size={18} fill={hasAlert ? "currentColor" : "none"} />
        </button>
        <button 
          className="icon-button" 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          style={{ 
            background: 'var(--red-soft)', 
            color: 'var(--red)', 
            width: '36px', 
            height: '36px', 
            borderRadius: '10px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Remover dos favoritos"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', background: 'var(--surface-2)', borderRadius: '12px', padding: '1rem' }}>
        <img src={product.image_url || "/products/arroz-tio-joao-5kg.png"} alt={product.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{product.brand}</span>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0.25rem 0', minHeight: '2.6em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.name}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{product.size} • {product.establishment}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block' }}>Menor preço em Feijó</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--green)', fontWeight: 900 }}>{money(product.minPrice)}</strong>
        </div>
        <PriceChangeBadge current={product.minPrice} previous={product.previousPrice} capturedAt={product.capturedAt} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button 
          className="button button--primary" 
          style={{ flex: 1, height: '44px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          onClick={(e) => { e.stopPropagation(); onAddBasket(); }}
        >
          <ShoppingBasket size={18} /> <span className="hide-mobile">Cesta</span>
        </button>
        <button 
          className="button button--outline" 
          style={{ width: '44px', height: '44px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={openDetails}
          title="Ver detalhes"
        >
          <Search size={18} />
        </button>
      </div>
    </div>
  );
}

