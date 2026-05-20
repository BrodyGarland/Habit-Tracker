const percentageElement = document.getElementById("percentage");
const newHabitInput = document.getElementById("new-habit-input");
const categorySelect = document.getElementById("category-select");
const addHabitButton = document.getElementById("add-habit-button");
const backupButton = document.getElementById("backup-button");
const habitList = document.getElementById("habit-list");

console.log(percentageElement, newHabitInput, categorySelect, addHabitButton, backupButton, habitList );


addHabitButton.addEventListener("click", function(){
    const habitName = newHabitInput.value;
    const habitCategory = categorySelect.value;

    console.log("New habit:", habitName);
    console.log("Category:", habitCategory);
});

