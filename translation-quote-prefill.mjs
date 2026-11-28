// Carries an instant estimate into the request form so the customer and the
// reviewer see the same numbers. Nothing here is trusted by the server.
const params = new URLSearchParams(location.search);
const words = params.get('words');
const category = params.get('category');
const total = params.get('quoted-total');
const count = document.getElementById('word-count');
if (count && words && /^\d+$/.test(words)) count.value = words;
const hiddenTotal = document.getElementById('quoted-total');
if (hiddenTotal && total && /^\d+(\.\d{1,2})?$/.test(total)) hiddenTotal.value = total + ' MAD';
const hiddenCategory = document.getElementById('quoted-category');
if (hiddenCategory && category) hiddenCategory.value = category;
