/* The school host keeps PINs and tokens. Only game state crosses this port. */
(() => {
  'use strict';
  if (parent === window) return;
  document.querySelector('.demo-school-link')?.remove();
  document.querySelector('#save-status').textContent = 'Connecting to school…';
  let port, init, sequence = 0;
  const pending = new Map();
  const ready = new Promise(resolve => { init = resolve; });
  addEventListener('message', function connect(event) {
    if (event.source !== parent || event.data?.type !== 'checkling-camp-connect' || !event.ports[0] || port) return;
    port = event.ports[0];
    port.onmessage = ({data}) => {
      if (data.type === 'init') { init(data.payload); return; }
      if (data.type === 'access') { dispatchEvent(new CustomEvent('checkling-school-access',{detail:data.payload})); return; }
      const request = pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timer); pending.delete(data.id);
      if (data.error) request.reject(Error(data.error)); else request.resolve(data.payload);
    };
    port.start();
    port.postMessage({type:'ready'});
  });
  function request(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(Error('Save not confirmed. Retry or save a file before leaving.')); }, 45000);
      pending.set(id,{resolve,reject,timer});
      port.postMessage({type,id,payload});
    });
  }
  let lastActive = 0;
  for (const type of ['pointerdown','keydown']) addEventListener(type, () => {
    if (port && Date.now() - lastActive > 1000) { lastActive = Date.now(); port.postMessage({type:'activity'}); }
  },true);
  globalThis.ChecklingSchool = {ready,request,close:() => port?.postMessage({type:'close'})};
})();
