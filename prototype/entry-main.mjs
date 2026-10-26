import {seed,initialize} from './model.mjs';
import {initAccess} from './access-control.mjs';
import {mountEntry} from './entry-ui.mjs';
let saved;try{saved=JSON.parse(sessionStorage.getItem('routefit-r1-prototype-v1')||'null')}catch{}
const db=initAccess(initialize(saved?.schema===1?saved:seed()));
mountEntry(document.querySelector('#entry'),db.access.accounts);
