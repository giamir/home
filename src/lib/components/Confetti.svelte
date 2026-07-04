<script lang="ts">
	// Lightweight CSS confetti burst — no dependencies. Mount to fire once.
	const COLORS = ['#059669', '#0284c7', '#f59e0b', '#db2777', '#8b5cf6'];
	const pieces = Array.from({ length: 28 }, (_, i) => ({
		left: Math.random() * 100,
		delay: Math.random() * 0.3,
		duration: 1.4 + Math.random() * 1.2,
		size: 6 + Math.random() * 6,
		color: COLORS[i % COLORS.length],
		spin: Math.random() > 0.5 ? 1 : -1
	}));
</script>

<div class="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
	{#each pieces as piece, i (i)}
		<span
			class="confetti-piece"
			style="left: {piece.left}%; width: {piece.size}px; height: {piece.size * 0.6}px;
				background: {piece.color}; animation-delay: {piece.delay}s;
				animation-duration: {piece.duration}s; --spin: {piece.spin};"
		></span>
	{/each}
</div>

<style>
	.confetti-piece {
		position: absolute;
		top: -3vh;
		border-radius: 2px;
		animation-name: confetti-fall;
		animation-timing-function: ease-in;
		animation-fill-mode: forwards;
	}
	@keyframes confetti-fall {
		0% {
			transform: translateY(0) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translateY(105vh) rotate(calc(var(--spin) * 720deg));
			opacity: 0.6;
		}
	}
</style>
