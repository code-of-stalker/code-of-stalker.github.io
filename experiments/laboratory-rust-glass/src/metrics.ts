export function summarize(intervals:number[],costs:number[]) {
  const sorted=intervals.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  const count=sorted.length;
  const percentile=(p:number)=>count?sorted[Math.min(count-1,Math.ceil(count*p)-1)]:0;
  return {frames:count,fps:count?1000/(sorted.reduce((a,b)=>a+b,0)/count):0,p50:percentile(.5),p95:percentile(.95),
    over34:count?100*sorted.filter(x=>x>34).length/count:0,cpuMs:costs.length?costs.reduce((a,b)=>a+b,0)/costs.length:0};
}
