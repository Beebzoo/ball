/* ball3d.js: a real football as SVG.
   Truncated icosahedron (12 pentagons, 20 hexagons) on a sphere, seams as
   great-circle arcs, orthographic view, lit per panel with a "puffed" panel
   gradient, a soft specular and rim darkening. No dependencies; works in the
   browser (window.Ball3D) and in Node (module.exports). */
(function(root){
  const PHI = (1 + Math.sqrt(5)) / 2;
  const add = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
  const sub = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const mul = (a,k)=>[a[0]*k,a[1]*k,a[2]*k];
  const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm = a=>{const l=Math.hypot(a[0],a[1],a[2]);return [a[0]/l,a[1]/l,a[2]/l];};

  function cyclicSigned(base){
    const out=[];
    for(const sx of [1,-1]) for(const sy of [1,-1]) for(const sz of [1,-1]){
      const v=[base[0]*sx,base[1]*sy,base[2]*sz];
      out.push(v,[v[1],v[2],v[0]],[v[2],v[0],v[1]]);
    }
    const seen=new Set(), res=[];
    for(const v of out){const k=v.map(x=>x.toFixed(5)).join(",");if(!seen.has(k)){seen.add(k);res.push(v);}}
    return res;
  }

  /* geometry, built once */
  const VERTS = [].concat(
    cyclicSigned([0,1,3*PHI]), cyclicSigned([1,2+PHI,2*PHI]), cyclicSigned([PHI,2,2*PHI+1])
  ).map(norm);
  const PENT_C = cyclicSigned([0,1,PHI]).map(norm);
  const HEX_C  = cyclicSigned([1,1,1]).concat(cyclicSigned([0,PHI,1/PHI])).map(norm);
  function faceFor(c,k){
    const vs = VERTS.map(v=>[dot(v,c),v]).sort((a,b)=>b[0]-a[0]).slice(0,k).map(x=>x[1]);
    let u = norm(sub(vs[0], mul(c, dot(vs[0],c)))); const w = cross(c,u);
    vs.sort((a,b)=>Math.atan2(dot(a,w),dot(a,u))-Math.atan2(dot(b,w),dot(b,u)));
    return {c, vs, pent:k===5, ang:Math.acos(dot(c,vs[0]))};
  }
  const FACES = PENT_C.map(c=>faceFor(c,5)).concat(HEX_C.map(c=>faceFor(c,6)));

  /* rotations */
  function axisRot(u,t){ // Rodrigues matrix
    const [x,y,z]=u,c=Math.cos(t),s=Math.sin(t),C=1-c;
    return [[c+x*x*C,x*y*C-z*s,x*z*C+y*s],[y*x*C+z*s,c+y*y*C,y*z*C-x*s],[z*x*C-y*s,z*y*C+x*s,c+z*z*C]];
  }
  const mmul=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
  const apply=(M,v)=>[dot(M[0],v),dot(M[1],v),dot(M[2],v)];
  /* view: a pentagon turned toward (tx,ty) on the face, then spun */
  function viewMatrix(tx,ty,spin){
    const a = PENT_C.find(c=>c[0]===0&&c[1]>0&&c[2]>0) || PENT_C[0];
    const b = norm([tx,ty,1]);
    const ax = cross(a,b), s = Math.hypot(...ax);
    const R1 = s<1e-9 ? [[1,0,0],[0,1,0],[0,0,1]] : axisRot(norm(ax), Math.atan2(s,dot(a,b)));
    return mmul(axisRot(b, spin*Math.PI/180), R1);
  }

  /* colour */
  const hex2=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const rgb=c=>"#"+c.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,"0")).join("");
  const shade=(h,k,toward=[255,255,255],t=0)=>{const c=hex2(h);return rgb(c.map((x,i)=>x*k*(1-t)+toward[i]*t));};

  /* each material: [shadow, base, highlight]; light t runs 0..1 shadow->base, 1..2 base->highlight */
  const PALETTES = {
    gold:    {hex:["#4a2c03","#d9a23a","#fff3c4"], pent:["#04140b","#17502f","#4f9a6c"], seam:"#2b1803", metal:true,  spec:.55},
    classic: {hex:["#77736b","#efece4","#ffffff"], pent:["#07090a","#22292c","#59636a"], seam:"#2f3436", metal:false, spec:.8},
    /* cream: warm ivory leather, metallic gold pentagons, pressed seams, a broad sheen */
    cream:   {hex:["#b8955e","#f4ebd3","#fffdf5"], pent:["#4a2c03","#d9a23a","#fff3c4"], seam:"#5a4110", metal:false, pentMetal:true,
              spec:.75, rim:.42, edge:"#4a3008", groove:true, sheen:true},
  };
  const tone=(m,t)=>{t=Math.max(0,Math.min(2,t));const a=hex2(t<1?m[0]:m[1]),b=hex2(t<1?m[1]:m[2]),u=t<1?t:t-1;return rgb(a.map((x,i)=>x+(b[i]-x)*u));};

  let N = 0;
  /* make({cx,cy,R, palette, tx,ty,spin, small, shadow}) -> SVG fragment (no <svg> wrapper) */
  function make(o){
    o = Object.assign({cx:50,cy:50,R:40,palette:"gold",tx:-.16,ty:.2,spin:8,yaw:0,small:false,shadow:false,stitch:false,grain:false,windows:false},o);
    const P = typeof o.palette==="string" ? PALETTES[o.palette] : o.palette;
    const {cx,cy,R} = o, id = "b3"+(++N)+"_";
    const M = mmul(axisRot([0,1,0], o.yaw*Math.PI/180), viewMatrix(o.tx,o.ty,o.spin)); // yaw = rolling about the vertical axis
    const L = norm([-.55,.62,.68]);            // light: upper left, in front
    const H = norm(add(L,[0,0,1]));            // half vector for gloss
    const scr = p => [cx + R*p[0], cy - R*p[1]];
    let defs = "", body = "", stitches = "", seams = "";
    const SEG = o.small ? 6 : 14;

    for (const f of FACES){
      const vs = f.vs.map(v=>apply(M,v));
      if (Math.max(...vs.map(v=>v[2])) < -0.02) continue;
      const pts = [];
      for (let i=0;i<vs.length;i++){
        const a=vs[i], b=vs[(i+1)%vs.length];
        for (let s=0;s<SEG;s++){
          let p = norm(add(mul(a,1-s/SEG),mul(b,s/SEG)));
          if (p[2] < 0){ const l=Math.hypot(p[0],p[1]); p=[p[0]/l,p[1]/l,0]; } // fold the hidden part onto the rim
          pts.push(scr(p));
        }
      }
      const n = apply(M,f.c);
      if (o.stitch && !o.small && n[2] > .05){ // a dashed row just inside each seam
        const ins = vs.map(v=>norm(add(mul(v,.93),mul(n,.07)))), sp = [];
        for (let i=0;i<ins.length;i++){ const a=ins[i], b=ins[(i+1)%ins.length];
          for (let q=0;q<=SEG;q++){ let pp = norm(add(mul(a,1-q/SEG),mul(b,q/SEG))); if (pp[2]<0) continue; sp.push(scr(pp)); } }
        stitches += '<polygon points="'+sp.map(p=>p[0].toFixed(2)+","+p[1].toFixed(2)).join(" ")+'" fill="none" stroke="'+P.seam+'" stroke-opacity="'+(.35*Math.min(1,n[2]*1.6)).toFixed(2)+'" stroke-width="'+(R*.009).toFixed(3)+'" stroke-dasharray="'+(R*.018).toFixed(2)+' '+(R*.016).toFixed(2)+'" stroke-linecap="round"/>';
      }
      const lam = Math.max(0,dot(n,L)), gl = Math.pow(Math.max(0,dot(n,H)), P.metal?10:28);
      const mat = f.pent ? P.pent : P.hex, shiny = f.pent ? !!P.pentMetal : P.metal;
      const t = .34 + .9*lam + (shiny ? (f.pent ? .5 : .9)*gl : f.pent ? .1*gl : .25*gl);
      const ctr = tone(mat, t+(f.pent?.05:.14)), mid = tone(mat, t), edge = tone(mat, t-(f.pent?.12:.22));
      const [px,py] = scr(n), th = Math.atan2(py-cy, px-cx)*180/Math.PI;
      const fz = Math.max(.12, n[2]), rr = R*Math.sin(f.ang)*1.08;
      const gid = id+"g"+body.length;
      defs += '<radialGradient id="'+gid+'" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate('+px.toFixed(2)+' '+py.toFixed(2)+') rotate('+th.toFixed(1)+') scale('+(rr*fz).toFixed(2)+' '+rr.toFixed(2)+')">' +
              '<stop offset="0" stop-color="'+ctr+'"/><stop offset=".62" stop-color="'+mid+'"/><stop offset="1" stop-color="'+edge+'"/></radialGradient>';
      const ptsStr = pts.map(p=>p[0].toFixed(2)+","+p[1].toFixed(2)).join(" ");
      if (P.groove && !o.small){ // fills first, seams drawn as one pressed groove pass afterwards
        body += '<polygon points="'+ptsStr+'" fill="url(#'+gid+')"/>';
        seams += '<polygon points="'+ptsStr+'"/>';
      } else
        body += '<polygon points="'+ptsStr+'" fill="url(#'+gid+')" stroke="'+P.seam+'" stroke-opacity="'+(o.small?.55:.42)+'" stroke-width="'+(R*(o.small?.035:.016)).toFixed(3)+'" stroke-linejoin="round"/>';
    }

    // light source position on screen for the gloss
    const lx = cx - R*.4, ly = cy - R*.44;
    defs += '<clipPath id="'+id+'c"><circle cx="'+cx+'" cy="'+cy+'" r="'+R+'"/></clipPath>' +
      '<radialGradient id="'+id+'rim" cx="'+cx+'" cy="'+cy+'" r="'+R+'" fx="'+(cx-R*.25)+'" fy="'+(cy-R*.3)+'" gradientUnits="userSpaceOnUse">' +
        '<stop offset=".55" stop-color="'+(P.edge||'#000')+'" stop-opacity="0"/><stop offset=".88" stop-color="'+(P.edge||'#000')+'" stop-opacity="'+((P.rim||.45)*.5)+'"/><stop offset="1" stop-color="'+(P.edge||'#000')+'" stop-opacity="'+(P.rim||.45)+'"/></radialGradient>' +
      '<filter id="'+id+'soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="'+(R*.13).toFixed(2)+'"/></filter>' +
      '<radialGradient id="'+id+'bounce" cx="'+(cx+R*.55)+'" cy="'+(cy+R*.6)+'" r="'+(R*.7)+'" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#fff2c4" stop-opacity=".18"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></radialGradient>' +
      '<filter id="'+id+'blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="'+(R*.07).toFixed(2)+'"/></filter>' +
      '<filter id="'+id+'win" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="'+(R*.012).toFixed(2)+'"/></filter>' +
      '<filter id="'+id+'grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="'+(34/R).toFixed(3)+'" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>' +
      '<filter id="'+id+'sh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="'+(R*.09).toFixed(2)+'"/></filter>';

    let out = "";
    if (o.shadow) out += '<ellipse cx="'+(cx+R*.08)+'" cy="'+(cy+R*.97)+'" rx="'+(R*.78)+'" ry="'+(R*.13)+'" fill="#000" fill-opacity=".55" filter="url(#'+id+'sh)"/>';
    out += '<g clip-path="url(#'+id+'c)">' +
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="'+P.seam+'"/>' + body +
      (seams ? '<g fill="none" stroke-linejoin="round">' +
        '<g stroke="'+P.seam+'" stroke-opacity=".16" stroke-width="'+(R*.042).toFixed(3)+'">'+seams+'</g>' +
        '<g stroke="#fffaf0" stroke-opacity=".35" stroke-width="'+(R*.022).toFixed(3)+'">'+seams+'</g>' +
        '<g stroke="'+P.seam+'" stroke-opacity=".7" stroke-width="'+(R*.01).toFixed(3)+'">'+seams+'</g></g>' : '') +
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="url(#'+id+'bounce)"/>' +
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="url(#'+id+'rim)"/>' +
      (o.grain && !o.small ? '<rect x="'+(cx-R)+'" y="'+(cy-R)+'" width="'+(2*R)+'" height="'+(2*R)+'" filter="url(#'+id+'grain)" opacity=".38" style="mix-blend-mode:soft-light"/>' : '') +
      stitches +
      (o.small ? '' : o.windows
        ? '<g transform="rotate(-28 '+lx.toFixed(2)+' '+ly.toFixed(2)+')" fill="#fff" filter="url(#'+id+'win)">' +
            '<rect x="'+(lx-R*.2).toFixed(2)+'" y="'+(ly-R*.1).toFixed(2)+'" width="'+(R*.17).toFixed(2)+'" height="'+(R*.13).toFixed(2)+'" rx="'+(R*.04).toFixed(2)+'" fill-opacity="'+(P.spec*.95).toFixed(2)+'"/>' +
            '<rect x="'+(lx+R*.01).toFixed(2)+'" y="'+(ly-R*.1).toFixed(2)+'" width="'+(R*.17).toFixed(2)+'" height="'+(R*.13).toFixed(2)+'" rx="'+(R*.04).toFixed(2)+'" fill-opacity="'+(P.spec*.95).toFixed(2)+'"/>' +
            '<rect x="'+(lx-R*.2).toFixed(2)+'" y="'+(ly+R*.06).toFixed(2)+'" width="'+(R*.38).toFixed(2)+'" height="'+(R*.05).toFixed(2)+'" rx="'+(R*.025).toFixed(2)+'" fill-opacity="'+(P.spec*.45).toFixed(2)+'"/></g>' +
          '<ellipse cx="'+(cx+R*.42).toFixed(2)+'" cy="'+(cy+R*.5).toFixed(2)+'" rx="'+(R*.2).toFixed(2)+'" ry="'+(R*.06).toFixed(2)+'" transform="rotate(-40 '+(cx+R*.42).toFixed(2)+' '+(cy+R*.5).toFixed(2)+')" fill="#fff" fill-opacity=".14" filter="url(#'+id+'blur)"/>'
        : (P.sheen ? '<ellipse cx="'+(lx+R*.12).toFixed(2)+'" cy="'+(ly+R*.14).toFixed(2)+'" rx="'+(R*.5).toFixed(2)+'" ry="'+(R*.34).toFixed(2)+'" transform="rotate(-35 '+(lx+R*.12).toFixed(2)+' '+(ly+R*.14).toFixed(2)+')" fill="#fff" fill-opacity=".28" filter="url(#'+id+'soft)"/>' : '') +
          '<ellipse cx="'+lx.toFixed(2)+'" cy="'+ly.toFixed(2)+'" rx="'+(R*.24).toFixed(2)+'" ry="'+(R*.11).toFixed(2)+'" transform="rotate(-35 '+lx.toFixed(2)+' '+ly.toFixed(2)+')" fill="#fff" fill-opacity="'+P.spec+'" filter="url(#'+id+'blur)"/>') +
      '</g>' +
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+(R-R*.006)+'" fill="none" stroke="'+(P.edge||'#000')+'" stroke-opacity=".45" stroke-width="'+(R*.02).toFixed(3)+'"/>';
    return '<defs>'+defs+'</defs>'+out;
  }

  const api = {make, PALETTES, faces:FACES.length, verts:VERTS.length};
  if (typeof module!=="undefined" && module.exports) module.exports = api; else root.Ball3D = api;
})(typeof window!=="undefined"?window:globalThis);
