import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    section: string;
}

interface State {
    hasError: boolean;
}

export class TvSectionBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`[TV ${this.props.section}]`, error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full bg-neutral-900 rounded-lg border border-neutral-800 p-4">
                    <AlertCircle className="h-5 w-5 text-red-500 mb-2" />
                    <span className="text-[10px] text-neutral-500 uppercase font-mono mb-2">
                        {this.props.section} — Erro
                    </span>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <RefreshCw className="h-3 w-3" /> Tentar novamente
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
