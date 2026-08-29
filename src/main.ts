import './style.css';
import { App } from './client/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app');
new App(root);
