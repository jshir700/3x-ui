import { useCallback, useEffect, useRef, useState } from 'react';
import { HttpUtil } from '@/utils';

interface Subscription {
  id: number;
  subId: string;
  remark: string;
  enable: boolean;
  format: string;
  password?: string;
  expiryTime: number;
  showInfo: boolean;
  emailInRemark: boolean;
  title: string;
  supportUrl: string;
  profileUrl: string;
  announce: string;
  updateInterval: number;
  syncWithInboundOrder: boolean;
  autoIncludeAllEnabled: boolean;
  userAgentEnabled: boolean;
  userAgentValues: string;
  clientEmails: string;
  inboundCount: number;
  clientCount: number;
  trafficDown: number;
  trafficUp: number;
  quotaTotal: number;
  callCount: number;
  lastUsed: number;
  createdAt: number;
  updatedAt: number;
}

export function useSubscription() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const msg = await HttpUtil.get('/panel/api/subscription/list') as { success?: boolean; obj?: Subscription[] };
      if (msg?.success) {
        if (mountedRef.current) {
          setSubscriptions(msg.obj || []);
          setFetched(true);
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (payload: Record<string, unknown>) => {
    return HttpUtil.post('/panel/api/subscription/add', payload, {
      headers: { 'Content-Type': 'application/json' },
    });
  }, []);

  const update = useCallback(async (id: number, payload: Record<string, unknown>) => {
    return HttpUtil.post(`/panel/api/subscription/update/${id}`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
  }, []);

  const remove = useCallback(async (id: number) => {
    const msg = await HttpUtil.post(`/panel/api/subscription/del/${id}`) as { success?: boolean };
    if (msg?.success) await fetchAll();
    return msg;
  }, [fetchAll]);

  const setEnable = useCallback(async (id: number, enable: boolean) => {
    return HttpUtil.post(`/panel/api/subscription/setEnable/${id}`, { enable });
  }, []);

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
