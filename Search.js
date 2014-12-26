function OnLoad() {
	$("#back_button").click(function(event) {
		Cancel();
	});
}

function Cancel() {
	location.href = 'QueueView.html';
}

document.addEventListener('DOMContentLoaded', function () {
	OnLoad();
});