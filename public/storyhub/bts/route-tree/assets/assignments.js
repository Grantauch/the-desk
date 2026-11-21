/* Local reading tools only. Account saving and Turn In belong to desk-save.js. */
(() => {
  document.querySelectorAll('.funnel').forEach(box => {
    const readings={all:'1,000 high school players: begin with the size of the opportunity.',college:'About 73 play NCAA football. A college place is already a narrow door.',draft:'About 1 high school senior in 1,000 is drafted. These are approximate cohort comparisons, not a followed group.'};
    box.querySelectorAll('button[data-step]').forEach(button=>button.addEventListener('click',()=>{
      box.dataset.step=button.dataset.step;
      box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      box.querySelector('output').textContent=readings[button.dataset.step];
    }));
  });
  const bank=document.getElementById('claim-bank');
  if(bank){
    const claims=JSON.parse(bank.textContent),answered=new Set();
    document.querySelectorAll('.claim-card').forEach((card,index)=>{
      card.querySelectorAll('button[data-call]').forEach(button=>button.addEventListener('click',()=>{
        const item=claims[index],feedback=card.querySelector('.claim-feedback');
        card.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
        feedback.replaceChildren();
        const title=document.createElement('b');title.textContent='Evidence check: '+item.verdict;
        const text=document.createElement('span');text.textContent=item.explanation;
        feedback.append(title,text);feedback.hidden=false;answered.add(index);
        document.getElementById('claim-progress').textContent=answered.size+' of 5 evidence calls checked. You can revise any call.';
      }));
    });
  }
  document.querySelectorAll('textarea[data-word-target]').forEach(field=>{
    const counter=document.getElementById(field.getAttribute('aria-describedby'));
    const render=()=>{const words=field.value.trim().match(/\S+/g)||[];counter.textContent=words.length+' words · target 90–110 words';};
    field.addEventListener('input',render);field.addEventListener('change',render);render();
    // Shared save restoration dispatches input; this also covers native history restoration.
    window.addEventListener('pageshow',render);
  });
})();
