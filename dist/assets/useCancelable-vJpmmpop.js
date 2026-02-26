import{c2 as o}from"./index-B0QoiLGO.js";/*! All material copyright ESRI, All Rights Reserved, unless otherwise specified.
See https://github.com/Esri/calcite-design-system/blob/dev/LICENSE.md for details.
v3.3.3 */const s=()=>o((a,c)=>{const e=new Set;return c.onDisconnected(()=>{e.forEach(r=>r.cancel())}),{add:r=>{[r].flat().forEach(n=>e.add(n))},resources:e}});export{s as u};
