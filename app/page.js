import { tender, listBidders, SOURCES } from '../lib/engine.js';
import Dashboard from './dashboard.jsx';

export default function Page() {
  return <Dashboard tender={tender} bidders={listBidders()} sources={SOURCES} />;
}
