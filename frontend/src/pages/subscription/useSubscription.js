import { onMounted, onUnmounted, ref } from 'vue';
import { HttpUtil } from '@/utils';

export function useSubscription() {
  const subscriptions = ref([]);
  const loading = ref(false);
  const fetched = ref(false);

  async function fetchAll() {
    loading.value = true;
    try {
      const msg = await HttpUtil.get('/panel/api/subscription/list');
      if (msg?.success) {
        subscriptions.value = msg.obj || [];
        fetched.value = true;
      }
    } finally {
      loading.value = false;
    }
  }

  async function create(payload) {
    return HttpUtil.post('/panel/api/subscription/add', payload, {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async function update(id, payload) {
    return HttpUtil.post(`/panel/api/subscription/update/${id}`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async function remove(id) {
    const msg = await HttpUtil.post(`/panel/api/subscription/del/${id}`);
    if (msg?.success) await fetchAll();
    return msg;
  }

  async function setEnable(id, enable) {
    return HttpUtil.post(`/panel/api/subscription/setEnable/${id}`, { enable });
  }

  onMounted(fetchAll);

  return {
    subscriptions,
    loading,
    fetched,
    fetchAll,
    create,
    update,
    remove,
    setEnable,
  };
}
