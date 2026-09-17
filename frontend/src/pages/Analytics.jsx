import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Bot, Send, Trash2, TrendingDown, Package } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import '../styles/analytics.css';

const Analytics = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState([
    { role: 'bot', text: 'Ask me about your inventory, expiry risk, or spending.' }
  ]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await api.getProducts({ page: 1, limit: 1000 });
        setProducts(data.products || []);
      } catch (error) {
        console.error('Analytics inventory load failed:', error);
      }
    };
    void loadProducts();
  }, []);

  const analytics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expired = products.filter((product) => new Date(product.expiry_date) < today).length;
    const expiring = products.filter((product) => {
      const days = Math.ceil((new Date(product.expiry_date) - today) / 86400000);
      return days >= 0 && days <= 7;
    }).length;
    const categoryTotals = products.reduce((totals, product) => {
      totals[product.category] = (totals[product.category] || 0) + 1;
      return totals;
    }, {});
    const fresh = products.length - expired - expiring;
    return { expired, expiring, fresh, categoryTotals };
  }, [products]);

  const askAnalytics = (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    const lowerText = text.toLowerCase();
    let answer = `You have ${products.length} products tracked: ${analytics.fresh} fresh, ${analytics.expiring} expiring soon, and ${analytics.expired} expired.`;
    if (lowerText.includes('expir')) answer = `${analytics.expired} products are expired and ${analytics.expiring} will expire within 7 days.`;
    if (lowerText.includes('waste') || lowerText.includes('risk')) answer = analytics.expired > 0 ? `There are ${analytics.expired} expired products. Review them first to reduce waste.` : 'No expired products are currently recorded.';
    setChat((current) => [...current, { role: 'user', text }, { role: 'bot', text: answer }]);
    setQuestion('');
  };

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Navbar placeholder="Search inventory..." />
        <div className="page-container analytics-page">
          <div className="analytics-heading">
            <div><h2>{t('analytics')}</h2><p>{t('analyticsCopy')}</p></div>
            <BarChart3 size={30} />
          </div>

          <div className="analytics-metrics">
            <div className="analytics-metric"><Package size={20} /><strong>{products.length}</strong><span>Products tracked</span></div>
            <div className="analytics-metric analytics-metric-warning"><TrendingDown size={20} /><strong>{analytics.expiring}</strong><span>Expiring within 7 days</span></div>
            <div className="analytics-metric analytics-metric-danger"><Trash2 size={20} /><strong>{analytics.expired}</strong><span>Expired products</span></div>
            <div className="analytics-metric analytics-metric-money"><BarChart3 size={20} /><strong>{Object.keys(analytics.categoryTotals).length}</strong><span>Product categories</span></div>
          </div>

          <div className="analytics-grid">
            <section className="card analytics-panel">
              <div className="analytics-panel-heading"><div><h3>Inventory distribution</h3><p>Products grouped by category.</p></div><Package size={20} /></div>
              <div className="analytics-chart">{Object.keys(analytics.categoryTotals).length === 0 ? <p className="muted-empty-text">Add products to see the chart.</p> : Object.entries(analytics.categoryTotals).map(([categoryName, count]) => <div className="category-bar-row" key={categoryName}><span>{categoryName}</span><div><i style={{ width: `${Math.max(8, count / Math.max(products.length, 1) * 100)}%` }} /></div><strong>{count}</strong></div>)}</div>
            </section>

            <section className="card analytics-panel analytics-chat-panel">
              <div className="analytics-panel-heading"><div><h3>Analysis chat</h3><p>Ask questions about your current data.</p></div><Bot size={20} /></div>
              <div className="analytics-chat-messages">{chat.map((message, index) => <div className={`analytics-chat-message ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}</div>
              <form className="analytics-chat-form" onSubmit={askAnalytics}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Which products are expiring?" /><button type="submit" aria-label="Ask analytics question"><Send size={17} /></button></form>
            </section>
          </div>

          <section className="card analytics-panel category-analysis"><div className="analytics-panel-heading"><div><h3>Expiry overview</h3><p>Understand the current freshness of your inventory.</p></div></div><div className="expiry-chart-row"><span>Fresh</span><div><i className="expiry-chart-fresh" style={{ width: `${Math.max(0, analytics.fresh / Math.max(products.length, 1) * 100)}%` }} /></div><strong>{analytics.fresh}</strong></div><div className="expiry-chart-row"><span>Expiring soon</span><div><i className="expiry-chart-expiring" style={{ width: `${Math.max(0, analytics.expiring / Math.max(products.length, 1) * 100)}%` }} /></div><strong>{analytics.expiring}</strong></div><div className="expiry-chart-row"><span>Expired</span><div><i className="expiry-chart-expired" style={{ width: `${Math.max(0, analytics.expired / Math.max(products.length, 1) * 100)}%` }} /></div><strong>{analytics.expired}</strong></div></section>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
