import {
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Cpu,
  Database,
  Eye,
  FlaskConical,
  GitBranch,
  Globe,
  Layers,
  MessageSquare,
  Microscope,
  Network,
  Search,
  Shield,
  Sparkles,
  Target,
  Wrench,
  Zap,
} from "lucide-react";

/** Must match helix-api `AGENT_ICON_IDS` in config_loader.py */
export const AGENT_ICON_OPTIONS = [
  { id: "bot", Icon: Bot },
  { id: "brain", Icon: Brain },
  { id: "search", Icon: Search },
  { id: "database", Icon: Database },
  { id: "bar-chart", Icon: BarChart3 },
  { id: "shield", Icon: Shield },
  { id: "sparkles", Icon: Sparkles },
  { id: "microscope", Icon: Microscope },
  { id: "book-open", Icon: BookOpen },
  { id: "wrench", Icon: Wrench },
  { id: "network", Icon: Network },
  { id: "globe", Icon: Globe },
  { id: "message-square", Icon: MessageSquare },
  { id: "zap", Icon: Zap },
  { id: "target", Icon: Target },
  { id: "git-branch", Icon: GitBranch },
  { id: "layers", Icon: Layers },
  { id: "cpu", Icon: Cpu },
  { id: "eye", Icon: Eye },
  { id: "flask-conical", Icon: FlaskConical },
];

const ICON_BY_ID = Object.fromEntries(
  AGENT_ICON_OPTIONS.map(({ id, Icon }) => [id, Icon]),
);

export const DEFAULT_AGENT_ICON_ID = "bot";

export function resolveAgentIcon(iconId) {
  return ICON_BY_ID[iconId] || Bot;
}
