import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';

import { createPortal } from 'react-dom';

import { useNavigate, useLocation } from 'react-router-dom';

import { ChatList } from 'react-chat-elements';
import 'react-chat-elements/dist/main.css';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TimerIcon from '@mui/icons-material/Timer';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  startLogin,
  verifyLogin,
  listAvatars,
  getGroupCoverUrl,
} from '../api';
import { toast } from 'react-hot-toast';
import LoadingOverlay from '../LoadingOverlay';



interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`chat-tabpanel-${index}`}
      aria-labelledby={`chat-tab-${index}`}
      {...other}
      className="tab-panel"
    >
      {value === index && (
        <Box sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `chat-tab-${index}`,
    'aria-controls': `chat-tabpanel-${index}`,
  };
}

const groupCategories: Record<string, string[]> = {
  Sports: ['Football Fans', 'Basketball Lovers'],
  Movies: ['Sci-Fi Lovers', 'Comedy Club'],
};

// Merge helper functions to preserve locally drafted messages when
// conversations from the API are loaded.
const mergeMessages = (remote: any[] = [], local: any[] = []) => {
  const result = [...remote];
  local.forEach((m) => {
    const text = m.message_content ?? m.text ?? '';
    const from = m.sender_id ?? m.from;
    const exists = result.some(
      (r) =>
        (r.message_content ?? r.text ?? '') === text &&
        (r.sender_id ?? r.from) === from
    );
    if (!exists) {
      result.push(m);
    }
  });
  return result;
};

const mergeConversations = (remote: any[] = [], local: any[] = []) => {
  const map: Record<string, any> = {};
  remote.forEach((c) => {
    const key = c.conversationId ?? c.id;
    map[key] = { ...c, messages: c.messages || [] };
  });
  local.forEach((c) => {
    const key = c.conversationId ?? c.id;
    if (!map[key]) {
      map[key] = { ...c, messages: c.messages || [] };
    } else {
      map[key].messages = mergeMessages(map[key].messages, c.messages || []);
    }
  });
  return Object.values(map);
};

const mergeGroups = (remote: any[] = [], local: any[] = []) => {
  const map: Record<string, any> = {};
  remote.forEach((g) => {
    map[g.groupId] = {
      groupId: g.groupId,
      conversations: g.conversations || [],
    };
  });
  local.forEach((g) => {
    if (!map[g.groupId]) {
      map[g.groupId] = {
        groupId: g.groupId,
        conversations: g.conversations || [],
      };
    } else {
      map[g.groupId].conversations = mergeConversations(
        map[g.groupId].conversations,
        g.conversations || []
      );
    }
  });
  return Object.values(map);
};

const ChatInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = Number(searchParams.get('tab') ?? '0');
  const [groups, setGroups] = useState<any[]>([]);
  const [tabIndex, setTabIndex] = useState(initialTab);
  const [userGroups, setUserGroups] = useState<any[]>([]);

  useEffect(() => {
    let tgId: number | null = null;
    const tgStr = localStorage.getItem('tg_init_data');
    if (tgStr) {
      try {
        tgId = JSON.parse(tgStr).user?.id ?? null;
      } catch {
        // ignore
      }
    }
    if (!tgId) {
      const tg = (window as any).Telegram?.WebApp;
      tgId = tg?.initDataUnsafe?.user?.id ?? null;
    }

    if (!tgId) return;
    fetch(
      `https://prop-backend-worker.sharifgptxacc.workers.dev/api/user-conversations?telegramId=${tgId}`
    )
      .then((r) => r.json())
      .then((data) => {
        const convs = data.conversations || [];
        const map: Record<string, any> = {};
        convs.forEach((c: any) => {
          if (!map[c.groupId]) {
            map[c.groupId] = { groupId: c.groupId, conversations: [] };
          }
          map[c.groupId].conversations.push(c);
        });

        const remoteGroups = Object.values(map);

        const stored = localStorage.getItem('conversations');
        let mergedGroups = remoteGroups;
        if (stored) {
          try {
            const localGroups = JSON.parse(stored);
            mergedGroups = mergeGroups(remoteGroups, localGroups);
          } catch {
            /* ignore */
          }
        }

        setGroups(mergedGroups);
        localStorage.setItem('conversations', JSON.stringify(mergedGroups));
      })
      .catch(() => {
        const stored = localStorage.getItem('conversations');
        if (stored) setGroups(JSON.parse(stored));
      });
  }, []);

  useEffect(() => {
    if (tabIndex !== 3 || userGroups.length) return;
    let tgId: number | null = null;
    const tgStr = localStorage.getItem('tg_init_data');
    if (tgStr) {
      try {
        tgId = JSON.parse(tgStr).user?.id ?? null;
      } catch {
        /* ignore */
      }
    }
    if (!tgId) {
      const tg = (window as any).Telegram?.WebApp;
      tgId = tg?.initDataUnsafe?.user?.id ?? null;
    }
    if (!tgId) return;
    fetch(
      `https://prop-backend-worker.sharifgptxacc.workers.dev/api/groups?telegramId=${tgId}`
    )
      .then((r) => r.json())
      .then((data) => {
        const groups = Array.isArray(data.groups)
          ? data.groups.map((g: any) => g.group || g)
          : [];
       setUserGroups(groups);

      })
      .catch(() => setUserGroups([]));
  }, [tabIndex, userGroups.length]);

  const executedGroups = groups.filter((g) =>
    g.conversations?.some(
      (c: any) =>
        c.type === 'Executed' ||
        c.messages?.some((m: any) => m.status === 'executed')
    )
  );
  const scheduledGroups = groups.filter((g) =>
    g.conversations?.some(
      (c: any) =>
        c.type === 'Scheduled' ||
        c.messages?.some((m: any) => m.status === 'pending')
    )
  );
  const draftGroups = groups.filter((g) =>
    g.conversations?.some(
      (c: any) =>
        !c.type || c.type === 'Draft' ||
        c.messages?.some((m: any) => !m.status || m.status === 'draft')

    )
  );

  const mapChat = (g: any) => {
    const conversations = g.conversations || [];
    const lastConv = conversations[conversations.length - 1] || {};
    const lastMsg = lastConv.messages?.slice(-1)[0] || {};

    const id = g.groupId ?? g.id ?? '';
    const details = userGroups.find(
      (u) => String(u.id ?? u.groupId) === String(id)
    ) || {};

    let candidate =
      details.title ||
      details.name ||
      details.username ||
      g.title ||
      g.name ||
      g.username ||
      '';

    candidate = String(candidate).trim();
    if (candidate.startsWith('@')) candidate = candidate.slice(1);
    if (!candidate) {
      candidate = `Group ${id}`;
    }
    const name = candidate;

    const username = details.username || g.username;

    return {
      id,
      avatar: getGroupCoverUrl(
        username
          ? `${username.startsWith('@') ? username : '@' + username}`
          : String(id)
      ),

      alt: name,
      title: name,
      subtitle: lastMsg.text || '',
      date: lastMsg.createdAt ? new Date(lastMsg.createdAt) : undefined,
      dateString: lastMsg.createdAt
        ? new Date(lastMsg.createdAt).toLocaleString()
        : undefined,

      unread: 0,
    };
  };

  const executedChats = executedGroups.map(mapChat);
  const scheduledChats = scheduledGroups.map(mapChat);
  const draftChats = draftGroups.map(mapChat);
  const groupChats = (userGroups.length ? userGroups : groups).map(mapChat);



  const [viewportHeight, setViewportHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const speedDialRef = useRef<HTMLDivElement | null>(null);
  const dialSizeRef = useRef({ width: 80, height: 80 });
  const [speedDialPos, setSpeedDialPos] = useState(() => ({
    x:
      typeof window !== 'undefined'
        ? window.innerWidth - dialSizeRef.current.width
        : 300,
    y:
      typeof window !== 'undefined'
        ? window.innerHeight - dialSizeRef.current.height
        : 400,
  }));

  const clampDialPos = (pos: { x: number; y: number }) => {
    const vp: any = (window as any).visualViewport || window;
    const width = vp.width ?? (vp as Window).innerWidth;
    const height = vp.height ?? (vp as Window).innerHeight;
    const { width: dw, height: dh } = dialSizeRef.current;
    return {
      x: Math.max(0, Math.min(pos.x, width - dw)),
      y: Math.max(0, Math.min(pos.y, height - dh)),

    };
  };
  const [draggingDial, setDraggingDial] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState({
    displayName: '',
    occupation: '',
    assistantTraits: [] as string[],
    extraContext: '',
  });

  const [traitInput, setTraitInput] = useState('');

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const [telegramPassword, setTelegramPassword] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [loginId, setLoginId] = useState('');

  const handleToggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handlePromptChange = (
    field: 'displayName' | 'occupation' | 'extraContext',
    value: string
  ) => {
    setSystemPrompt((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddTrait = () => {
    const t = traitInput.trim();
    if (!t) return;
    setSystemPrompt((prev) => ({
      ...prev,
      assistantTraits: Array.from(new Set([...prev.assistantTraits, t])),
    }));
    setTraitInput('');
  };

  const handleDeleteTrait = (trait: string) => {
    setSystemPrompt((prev) => ({
      ...prev,
      assistantTraits: prev.assistantTraits.filter((t) => t !== trait),
    }));
  };

  const handleSendPhone = async () => {
    const phone = `${countryCode}${phoneNumber.trim()}`;
    if (!phone) return;
    let tgId: string | null = null;
    const tgStr = localStorage.getItem('tg_init_data');
    if (tgStr) {
      try {
        tgId = String(JSON.parse(tgStr).user?.id ?? '');
      } catch {
        /* ignore */
      }
    }
    if (!tgId) {
      const tg = (window as any).Telegram?.WebApp;
      tgId = tg?.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : null;
    }
    if (!tgId) return;
    setAddingUser(true);
    try {
      const id = await toast.promise(
        startLogin(tgId, phone),
        {
          loading: 'Sending code...',
          success: 'Code sent',
          error: 'Failed to send code',
        }
      );
      setLoginId(id);
      setCodeSent(true);

    } finally {
      setAddingUser(false);
    }
  };

  const handleVerifyCode = async () => {
    const code = verificationCode.trim();
    if (!code || !loginId) return;
    let tgId: string | null = null;
    const tgStr = localStorage.getItem('tg_init_data');
    if (tgStr) {
      try {
        tgId = String(JSON.parse(tgStr).user?.id ?? '');
      } catch {
        /* ignore */
      }
    }
    if (!tgId) {
      const tg = (window as any).Telegram?.WebApp;
      tgId = tg?.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : null;
    }
    if (!tgId) return;
    setAddingUser(true);
    try {
      await toast.promise(
        verifyLogin(loginId, code, telegramPassword.trim() || undefined),

        {
          loading: 'Verifying...',
          success: 'User logged in',
          error: (err) => err.message || 'Verification failed',
        },
      );


      setTelegramPassword('');

      const list = await listAvatars(tgId);
      try {
        localStorage.setItem('avatarIds', JSON.stringify(list));
      } catch {
        /* ignore */
      }
      handleCloseAddUser();

    } catch (err: any) {

    } finally {
      setAddingUser(false);
    }
  };

  const handleCloseAddUser = () => {
    setAddUserOpen(false);
    setCodeSent(false);

    setTelegramPassword('');
    setPhoneNumber('');
    setVerificationCode('');
    setLoginId('');
  };

  const handleSearchGroup = () => {
    const q = searchTerm.trim();
    if (!q) return;
    let tgId: number | null = null;
    const tgStr = localStorage.getItem('tg_init_data');
    if (tgStr) {
      try {
        tgId = JSON.parse(tgStr).user?.id ?? null;
      } catch {
        /* ignore */
      }
    }
    if (!tgId) {
      const tg = (window as any).Telegram?.WebApp;
      tgId = tg?.initDataUnsafe?.user?.id ?? null;
    }
    if (!tgId) return;

    setSearching(true);
    fetch('https://prop-backend-worker.sharifgptxacc.workers.dev/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: tgId, q }),
    })
      .then((r) => r.json())
      .then((data) => {
        const g = data?.group?.group;
        if (g && g.id) {

          setGroups((prev) => {
            if (prev.some((pg) => pg.groupId === g.id)) return prev;
            return [...prev, { groupId: g.id, conversations: [] }];
          });
          setUserGroups((prev) => {
            if (prev.some((pg) => pg.id === g.id)) return prev;
            return [...prev, g];
          });
          setSelectedGroups((prev) => Array.from(new Set([...prev, String(g.id)])));
          setSearchTerm('');
        }
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => setSearching(false));
  };


  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
      if (speedDialRef.current) {
        const rect = speedDialRef.current.getBoundingClientRect();
        dialSizeRef.current = { width: rect.width, height: rect.height };
      }

      setSpeedDialPos((pos) => clampDialPos(pos));
    };
    const viewport = (window as any).visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }
    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (speedDialRef.current) {
      const rect = speedDialRef.current.getBoundingClientRect();
      dialSizeRef.current = { width: rect.width, height: rect.height };
    }
    setSpeedDialPos(() => {
      const vp: any = (window as any).visualViewport || window;
      const width = vp.width ?? (vp as Window).innerWidth;
      const height = vp.height ?? (vp as Window).innerHeight;
      const { width: dw, height: dh } = dialSizeRef.current;
      return clampDialPos({ x: width - dw, y: height - dh });
    });

  }, []);

  useEffect(() => {
    if (!draggingDial) return;
    const handleMove = (e: PointerEvent) => {
      setSpeedDialPos((pos) =>
        clampDialPos({ x: pos.x + e.movementX, y: pos.y + e.movementY })
      );
    };
    const stop = () => setDraggingDial(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
    };
  }, [draggingDial]);


  return (
    <>
      <LoadingOverlay open={searching || addingUser} />
      <div className="chat-container" style={{ height: viewportHeight }}>
      <div className="inbox-header">
        <h2>Chats</h2>
        <IconButton size="large" className="settings-icon">
          <SettingsIcon />
        </IconButton>
      </div>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabIndex}
          onChange={(_, newValue) => setTabIndex(newValue)}
          aria-label="chat tabs"
          className="chat-tabs"
          variant="fullWidth"
        >
          <Tab label="Executed" {...a11yProps(0)} />
          <Tab label="Scheduled" {...a11yProps(1)} />
          <Tab label="Draft" {...a11yProps(2)} />
          <Tab label="Group List" {...a11yProps(3)} />
        </Tabs>
      </Box>
      <TabPanel value={tabIndex} index={0}>
        {executedChats.length ? (
          <ChatList
            className="chat-list"
            dataSource={executedChats}
            onClick={(item: any) => {
              navigate(`/chat/${(item as any).id}`);
            }}
          />
        ) : (
          <p className="empty-message">
            No executed messages yet. Tap + to create one.
          </p>
        )}
      </TabPanel>
      <TabPanel value={tabIndex} index={1}>
        {scheduledChats.length ? (
          <ChatList
            className="chat-list"
            dataSource={scheduledChats}
            onClick={(item: any) => {
              navigate(`/chat/${(item as any).id}`);
            }}
          />
        ) : (
          <p className="empty-message">
            No scheduled messages yet. Tap + to create one.
          </p>
        )}
      </TabPanel>
      <TabPanel value={tabIndex} index={2}>
        {draftChats.length ? (
          <ChatList
            className="chat-list"
            dataSource={draftChats}
            onClick={(item: any) => {
              navigate(`/chat/${(item as any).id}`);
            }}
          />
        ) : (
          <p className="empty-message">No drafts yet. Tap + to create one.</p>
        )}
      </TabPanel>
      <TabPanel value={tabIndex} index={3}>
        {groupChats.length ? (
          <ChatList
            className="chat-list"
            dataSource={groupChats}
            onClick={(item: any) => {
              navigate(`/chat/${(item as any).id}`);
            }}
          />
        ) : (
          <p className="empty-message">No groups found. Tap + to add one.</p>
        )}

      </TabPanel>



      <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} fullWidth>
        <DialogTitle>Select Groups</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <TextField
              placeholder="Search groups"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              fullWidth
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleSearchGroup}
              disabled={searching}
            >
              Search
            </Button>
          </div>
          <div style={{ height: 8 }} />
          {Object.entries(groupCategories).map(([cat, groups]) => (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 'bold' }}>{cat}</div>
              {groups
                .filter((g) => g.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((g) => (
                  <FormControlLabel
                    key={g}
                    control={
                      <Checkbox
                        checked={selectedGroups.includes(g)}
                        onChange={() => handleToggleGroup(g)}
                      />
                    }
                    label={g}
                  />
                ))}
            </div>
          ))}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button
            startIcon={<SmartToyIcon />}
            onClick={() => alert('AI will select groups soon...')}
          >
            Choose groups by AI
          </Button>
          <Button onClick={() => setGroupDialogOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={promptDialogOpen}
        onClose={() => setPromptDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
      <DialogTitle>System Prompt</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, marginBottom: 4 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} />
              What should Penemue call you?
            </div>

            <TextField
              label="Nickname"
              value={systemPrompt.displayName}
              onChange={(e) => handlePromptChange('displayName', e.target.value)}
              fullWidth
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, marginBottom: 4 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} />
              What do you do?
            </div>

            <TextField
              label="Occupation"
              value={systemPrompt.occupation}
              onChange={(e) => handlePromptChange('occupation', e.target.value)}
              fullWidth
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, marginBottom: 4 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} />
              What traits should Penemue have?
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
              {systemPrompt.assistantTraits.map((t) => (
                <Chip key={t} label={t} onDelete={() => handleDeleteTrait(t)} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <TextField
                placeholder="Describe or select traits"
                value={traitInput}
                onChange={(e) => setTraitInput(e.target.value)}
                fullWidth
                size="small"
              />
              <IconButton onClick={handleAddTrait} color="primary">
                <AddIcon />
              </IconButton>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, marginBottom: 4 }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} />
              Anything else Penemue should know about you?
            </div>

            <TextField
              label="Extra context"
              value={systemPrompt.extraContext}
              onChange={(e) => handlePromptChange('extraContext', e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromptDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addUserOpen} onClose={handleCloseAddUser} fullWidth>
        <DialogTitle>Add Telegram User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!codeSent ? (
            <>
              <TextField
                label="Country Code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                fullWidth
              />
              <TextField
                label="Phone Number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                fullWidth
              />
            </>
          ) : (
            <>
              <TextField
                label="2FA Code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                fullWidth
              />
              <TextField
                label="Password (optional)"
                type="password"
                value={telegramPassword}
                onChange={(e) => setTelegramPassword(e.target.value)}
                fullWidth
              />

            </>
          )}
        </DialogContent>
        <DialogActions>
          {!codeSent ? (
            <Button onClick={handleSendPhone} disabled={addingUser}>
              {addingUser ? <CircularProgress size={20} /> : 'Send Code'}
            </Button>
          ) : (
            <Button onClick={handleVerifyCode} disabled={addingUser}>
              {addingUser ? <CircularProgress size={20} /> : 'Verify'}
            </Button>
          )}
          <Button onClick={handleCloseAddUser}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
    {createPortal(
      <SpeedDial
        ref={speedDialRef}
        ariaLabel="chat actions"
        icon={<SpeedDialIcon />}
        open={speedDialOpen}
        onOpen={() => setSpeedDialOpen(true)}
        onClose={() => setSpeedDialOpen(false)}
        sx={{ position: 'fixed', top: speedDialPos.y, left: speedDialPos.x, zIndex: 3000 }}

        className="fab"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('.MuiSpeedDial-fab')) {
            setDraggingDial(true);
          }
        }}
      >
        <SpeedDialAction
          icon={<GroupAddIcon />}
          tooltipTitle="Add Group"
          onClick={() => {
            setSpeedDialOpen(false);
            setGroupDialogOpen(true);
          }}
        />
        <SpeedDialAction
          icon={<PersonAddIcon />}
          tooltipTitle="Add User"
          FabProps={{
            sx: {
              bgcolor: '#34aadf',
              color: '#fff',
              '&:hover': { bgcolor: '#289cc4' },
            },
          }}
          onClick={() => {
            setSpeedDialOpen(false);
            setAddUserOpen(true);
          }}
        />
        <SpeedDialAction
          icon={<SettingsSuggestIcon />}
          tooltipTitle="System Prompt"
          onClick={() => {
            setSpeedDialOpen(false);
            setPromptDialogOpen(true);
          }}
        />
        <SpeedDialAction
          icon={<SmartToyIcon />}
          tooltipTitle="Auto Chat"
          onClick={() => {
            setSpeedDialOpen(false);
            if (!systemPrompt.displayName && !systemPrompt.occupation) {
              setPromptDialogOpen(true);
            } else {
              alert(`Generating conversations for ${selectedGroups.join(', ') || 'selected groups'}...`);
            }
          }}
        />
        <SpeedDialAction
          icon={<TimerIcon />}
          tooltipTitle="Schedule"
          onClick={() => {
            setSpeedDialOpen(false);
            navigate('/chat');
          }}
        />
      </SpeedDial>,
      document.body
    )}
    </>
  );
};

export default ChatInboxPage;
