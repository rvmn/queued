This directory is for one-time updates to the application, for things like forcing a database
reset or wiping other persistent storage things.

Name a txt file the *exact* version string of the application you wish to execute and put it
in the versions directory, and then change the version to match in the XML manifest of the 
AIR application.

If you wish to debug your update instructions, do the following:

1) Find the application storage directory; under Windows, this would be:
	C:\Documents and Settings\[user]\Application Data\com.sitepen.Queued\Local Store
2) Within that directory, there is a preferences\version.txt file.
3) Change the version in that file to a lesser version (for example, if the current version
	is 0.78, change it to 0.7, etc.)
4) Run the application.

In general, only things that are persistent and reused (i.e. storage and databases) should be
addressed with these update files.
