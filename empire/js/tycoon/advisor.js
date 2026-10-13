// 值班建議只讀取狀態；所有操作仍由玩家確認，使用既有 state 動作。
import * as Eco from './economy.js';

export function operatingAdvice(bal, s, id, stats, projection) {
  const fab = s.fabs[id], cash = s.res.money, inv = s.res.inv[id] || 0;
  const mode = Eco.modeOf(fab), lot = Eco.lotCost(bal, id);
  const reserve = lot + Eco.fabUpkeep(bal, id, mode);
  const missing = fab.slots.findIndex(sl => !sl);
  const contracts = s.res.contracts.active.filter(c => c.fabId === id);
  const due = contracts.find(c => inv >= c.qty && stats.Y >= c.minY);
  const reserved = contracts.reduce((n, c) => n + c.qty, 0);
  const free = Math.max(0, inv - reserved);
  const room = Eco.sellRoom(Eco.dailyDemand(bal, s.res.demandIdx), s.res.soldToday[id] || 0);
  const next = bal.fabOrder.find(f => !s.fabs[f].unlocked);
  const goal = next ? { id: next, budget: Eco.startupBudget(bal, next), unlock: Eco.unlockStatus(bal, next, { money: cash, rep: s.res.rep, stars: s.puzzle.stars }) } : null;
  const result = (title, text, action, slot = null) => ({ title, text, action, slot, reserve, free, sellQty: Math.min(free, room), goal });
  if (due) return { ...result('訂單可以交貨', '庫存與良率已達要求，先履約可鎖定收入並釋放庫存。', 'market'), contract: due.id };
  if (fab.event) return result('先處理產線事件', '檢查停線、污染或故障的影響，再決定修復與排產。', 'event');
  if (mode === 'mothball') return result('產線已封存', '重新啟動需支付重啟費並暖機；先準備重啟與投片資金。', 'ops');
  if (mode === 'pause') return result('產線暫停中', '在製品已保留；恢復運轉不收費，但要確認週轉金足夠。', 'ops');
  if (missing >= 0) return result('補齊製程產線', `先安裝槽 ${missing + 1}「${bal.categories[bal.fabs[id].slots[missing]]}」。機台買齊後才會投片，記得保留週轉金。`, 'slot', missing);
  if (mode === 'drain') return result('正在收尾，沒有投新片', fab.lots.length ? '等在製品完成後賣出，再決定恢復運轉或封存。' : '在製品已清空，切回運轉才會繼續生產。', 'ops');
  if (cash < reserve) {
    if (free > 0 && room > 0) return result('先回收週轉金', `建議保留至少 $${reserve.toLocaleString('en-US')}，可先賣未保留給訂單的 ${Math.min(free, room)} 片。`, 'sell');
    return result('資金偏低', inv > 0 ? '庫存受訂單保留量或今日需求限制；檢查訂單、緊急出清與貸款。' : fab.lots.length ? '在製品仍會完成；可先只做完在製品，避免繼續投入現金。' : '沒有庫存與在製品可變現，請查看貸款與救援方案。', 'ops');
  }
  if (inv >= bal.startHaltInv || (s.res.invAge[id] || 0) >= 3) return result('清理積壓庫存', '庫存會占用現金、支付倉儲費並逐日折價；先交訂單，再賣多餘成品。', free > 0 && room > 0 ? 'sell' : 'market');
  if (projection.profitPerDay < 0) return result('目前行情下預估虧損', '先比較各檔轉速的良率與日利潤；暫停可減少維運，但不會產生成品。', 'market');
  if (goal && goal.unlock.all && cash >= goal.budget.total) return result('準備好擴建下一座廠', '解謎、聲望與開廠預算已備妥，可以查看擴建條件。', 'unlock');
  if (goal && !goal.unlock.puzzle.ok) return result('製程挑戰可先做', `不必等錢存夠。先完成 ${bal.fabs[next].zh} 的製程挑戰，讓擴建時立即具備良率加成。`, 'unlock');
  return result('穩定生產，累積擴建資金', projection.saturated ? '產能已高於需求，優先改善良率與庫存周轉。' : '留好投片資金，再評估瓶頸升級的回本時間。', 'market');
}
