"""The line-classification deep neural network."""
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence

from .document import LABELS
from .features import CHAR_VOCAB, NUM_FEATURES


class LineClassifier(nn.Module):
    """Character-CNN line encoder + BiGRU page context + per-line classifier.

    Input  : chars [B, L, C] (int64), feats [B, L, F] (float32), lengths [B]
    Output : logits [B, L, num_classes]
    """

    def __init__(
        self,
        n_features: int = NUM_FEATURES,
        n_classes: int = len(LABELS),
        emb_dim: int = 32,
        conv_dim: int = 96,
        hidden: int = 128,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.config = dict(
            n_features=n_features, n_classes=n_classes, emb_dim=emb_dim,
            conv_dim=conv_dim, hidden=hidden, dropout=dropout,
        )
        self.emb = nn.Embedding(CHAR_VOCAB, emb_dim, padding_idx=0)
        self.convs = nn.ModuleList(
            [nn.Conv1d(emb_dim, conv_dim, k, padding=k // 2) for k in (3, 5, 7)]
        )
        self.feat_proj = nn.Sequential(nn.Linear(n_features, 64), nn.ReLU())
        self.line_proj = nn.Sequential(
            nn.Linear(conv_dim * 3 + 64, hidden), nn.ReLU(), nn.Dropout(dropout)
        )
        self.context = nn.GRU(hidden, hidden, batch_first=True, bidirectional=True)
        self.head = nn.Sequential(
            nn.Linear(hidden * 3, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, n_classes),
        )

    def encode_lines(self, chars: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        b, l, c = chars.shape
        device = chars.device
        line_idx = torch.arange(l, device=device).unsqueeze(0)
        active = line_idx < lengths.to(device).unsqueeze(1)  # [B, L]
        active_chars = chars[active]  # [N_active, C]
        if active_chars.numel() == 0:
            return torch.zeros(b, l, self.config["conv_dim"] * len(self.convs), device=device)

        # Trim trailing character padding across active lines in this batch
        char_mask = active_chars != 0
        max_c = int(char_mask.any(dim=0).nonzero(as_tuple=False).max().item()) + 1 if char_mask.any() else 1
        max_c = max(max_c, 7)
        active_chars = active_chars[:, :max_c]
        mask = (active_chars != 0).unsqueeze(1)  # [N_active, 1, max_c]

        x = self.emb(active_chars).transpose(1, 2)  # [N_active, E, max_c]
        pooled = []
        for conv in self.convs:
            h = F.relu(conv(x))
            h = h.masked_fill(~mask, 0.0)
            pooled.append(h.max(dim=2).values)
        active_encoded = torch.cat(pooled, dim=1)  # [N_active, conv_dim * 3]

        out = torch.zeros(b, l, active_encoded.size(-1), device=device, dtype=active_encoded.dtype)
        out[active] = active_encoded
        return out

    def forward(self, chars, feats, lengths):
        char_features = self.encode_lines(chars, lengths)
        line_vec = self.line_proj(torch.cat([char_features, self.feat_proj(feats)], dim=-1))
        if chars.device.type == "mps":
            # Avoid pack_padded_sequence CPU fallback on MPS; zero out padded positions instead
            line_idx = torch.arange(line_vec.size(1), device=line_vec.device).unsqueeze(0)
            valid = (line_idx < lengths.to(line_vec.device).unsqueeze(1)).unsqueeze(-1)
            ctx, _ = self.context(line_vec * valid)
            ctx = ctx * valid
        else:
            packed = pack_padded_sequence(line_vec, lengths.cpu(), batch_first=True, enforce_sorted=False)
            ctx, _ = self.context(packed)
            ctx, _ = pad_packed_sequence(ctx, batch_first=True, total_length=line_vec.size(1))
        return self.head(torch.cat([ctx, line_vec], dim=-1))


def save_model(model: LineClassifier, path, metrics=None):
    torch.save({"config": model.config, "state_dict": {k: v.cpu() for k, v in model.state_dict().items()},
                "labels": LABELS, "metrics": metrics or {}}, path)


def load_model(path, device="cpu") -> LineClassifier:
    ckpt = torch.load(path, map_location=device, weights_only=False)
    model = LineClassifier(**ckpt["config"])
    model.load_state_dict(ckpt["state_dict"])
    model.to(device)
    model.eval()
    return model
