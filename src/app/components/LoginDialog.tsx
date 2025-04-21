import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Stack } from '@mui/material';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLogin: (username: string, password: string) => void;
  onUserUpdate?: () => void;
}

const LoginDialog: React.FC<LoginDialogProps> = ({ open, onClose, onLogin, onUserUpdate }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchUserInfo();
    }
  }, [open]);

  const fetchUserInfo = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '获取用户信息失败');
        return;
      }

      setUsername(data.username);
      setPassword(data.password);
      setError('');
    } catch (error) {
      console.error('Error fetching user info:', error);
      setError('获取用户信息失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEditUsername = () => {
    setError('');
    setTempUsername(username);
    setIsEditingUsername(true);
  };

  const handleStartEditPassword = () => {
    setError('');
    setTempPassword(password);
    setIsEditingPassword(true);
  };

  const handleSaveCredentials = async (field: 'username' | 'password') => {
    try {
      const response = await fetch('/api/auth', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentUsername: username,
          currentPassword: password,
          newUsername: field === 'username' ? tempUsername : undefined,
          newPassword: field === 'password' ? tempPassword : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '更新失败');
        return;
      }

      if (field === 'username') {
        setUsername(tempUsername);
        setIsEditingUsername(false);
        onUserUpdate?.();
      } else {
        setPassword(tempPassword);
        setIsEditingPassword(false);
      }

      setError('');
    } catch (error) {
      console.error('Error updating credentials:', error);
      setError('更新失败，请重试');
    }
  };

  const handleCancelEdit = (field: 'username' | 'password') => {
    setError('');
    if (field === 'username') {
      setIsEditingUsername(false);
    } else {
      setIsEditingPassword(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm" 
      sx={{ 
        '& .MuiDialog-paper': { 
          padding: 2,
          backgroundColor: '#f5f5f5',
          maxWidth: '400px'
        } 
      }}
    >
      <DialogTitle>
        <Typography variant="h6" component="div" sx={{ textAlign: 'center', mb: 1 }}>
          账号设置
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 1, textAlign: 'center' }}>
            {error}
          </Typography>
        )}
        {isLoading ? (
          <Typography variant="body2" sx={{ textAlign: 'center' }}>
            加载中...
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {isEditingUsername ? (
                <>
                  <TextField
                    fullWidth
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    size="small"
                    placeholder="输入新用户名"
                    autoFocus
                  />
                  <Button 
                    variant="contained" 
                    size="small" 
                    onClick={() => handleSaveCredentials('username')}
                  >
                    保存
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => handleCancelEdit('username')}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    用户名: {username}
                  </Typography>
                  <Button variant="outlined" size="small" onClick={handleStartEditUsername}>
                    更改
                  </Button>
                </>
              )}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              {isEditingPassword ? (
                <>
                  <TextField
                    fullWidth
                    type="password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    size="small"
                    placeholder="输入新密码"
                    autoFocus
                  />
                  <Button 
                    variant="contained" 
                    size="small" 
                    onClick={() => handleSaveCredentials('password')}
                  >
                    保存
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => handleCancelEdit('password')}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    密码: {'•'.repeat(password.length)}
                  </Typography>
                  <Button variant="outlined" size="small" onClick={handleStartEditPassword}>
                    更改
                  </Button>
                </>
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', py: 1 }}>
        <Button onClick={onClose} color="secondary" variant="outlined" size="small">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoginDialog; 