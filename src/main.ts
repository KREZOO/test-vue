import { createApp } from 'vue';
import App from './App.vue';

// PrimeVue
import PrimeVue from 'primevue/config';
import Button from 'primevue/button';
import Tooltip from 'primevue/tooltip';
import ToastService from 'primevue/toastservice';

// CSS
import './style.css'; // свои стили

const app = createApp(App);

app.use(PrimeVue);
app.use(ToastService);
app.directive('tooltip', Tooltip);
app.component('Button', Button);

app.mount('#app');
